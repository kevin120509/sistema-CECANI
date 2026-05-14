'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionResult } from '@/types/database';

/**
 * Guarda la URL del PDF generado automáticamente en el contrato.
 */
export async function guardarContratoGenerado(
  contratoId: string,
  urlPdf: string
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('contratos')
      .update({
        url_pdf_generado: urlPdf,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contratoId);

    if (error) {
      return {
        success: false,
        error: `Error al guardar contrato: ${error.message}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Error inesperado: ${error instanceof Error ? error.message : 'Desconocido'}`,
    };
  }
}

/**
 * Guarda la URL del PDF firmado por el cliente.
 */
export async function guardarContratoFirmado(
  contratoId: string,
  urlPdf: string
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('contratos')
      .update({
        url_pdf_firmado_cliente: urlPdf,
        estatus: 'firmado_cliente',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contratoId);

    if (error) {
      return {
        success: false,
        error: `Error al guardar contrato firmado: ${error.message}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Error inesperado: ${error instanceof Error ? error.message : 'Desconocido'}`,
    };
  }
}

import { generarContratoPDF } from '@/lib/pdf-generator';
import { subirBufferR2 } from '@/lib/r2';
import type { PlanPagos } from '@/types/database';

export async function generarContratoAutomatico(
  clienteId: string,
  expedienteId: string,
  contratoId: string
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();

    // 1. Obtener toda la info necesaria del expediente y perfil
    const { data: expedienteData, error: expError } = await supabase
      .from('expedientes')
      .select('nombre_empresa, figura:figura_id(descripcion)')
      .eq('id', expedienteId)
      .single();

    if (expError || !expedienteData) throw new Error('No se encontró el expediente');

    const { data: perfilData, error: perfError } = await supabase
      .from('perfiles')
      .select('nombre_completo, rfc, curp, ocupacion, estado_civil, domicilio_completo, folio_ine')
      .eq('id', clienteId)
      .single();

    if (perfError || !perfilData) throw new Error('No se encontró el perfil');

    const { data: contratoData, error: contError } = await supabase
      .from('contratos')
      .select('servicio_base, modulos_extra, monto_total, plan_pagos, url_pdf_generado')
      .eq('id', contratoId)
      .single();

    if (contError || !contratoData) throw new Error('No se encontró el contrato');

    // 2. Generar el PDF
    const pdfBuffer = await generarContratoPDF({
      nombreEmpresa: expedienteData.nombre_empresa,
      nombreRepresentante: perfilData.nombre_completo,
      figuraLegal: (expedienteData.figura as any)?.descripcion || 'Figura Legal',
      servicioBaseId: contratoData.servicio_base || '',
      modulosExtraIds: contratoData.modulos_extra || [],
      montoTotal: contratoData.monto_total || 0,
      planPagos: contratoData.plan_pagos as PlanPagos,
      rfc: perfilData.rfc,
      curp: perfilData.curp,
      ocupacion: perfilData.ocupacion,
      estadoCivil: perfilData.estado_civil,
      domicilioCompleto: perfilData.domicilio_completo,
      folioIne: perfilData.folio_ine,
    });

    // 3. Subir el PDF a Cloudflare R2
    const carpetaEmpresa = expedienteData.nombre_empresa.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
    const timestamp = Date.now();
    const fileName = `${timestamp}_CONTRATO_OFICIAL_${carpetaEmpresa}.pdf`;
    
    // USAR CLOUDFLARE R2 PARA EL CONTRATO
    const urlPublicaR2 = await subirBufferR2(
      pdfBuffer, 
      `expedientes/${carpetaEmpresa}/contratos`, 
      fileName, 
      'application/pdf'
    );

    // 4. Actualizar la base de datos (Supabase) con la URL de R2
    await guardarContratoGenerado(contratoId, urlPublicaR2);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Error al generar contrato automático: ${error instanceof Error ? error.message : 'Desconocido'}`,
    };
  }
}
