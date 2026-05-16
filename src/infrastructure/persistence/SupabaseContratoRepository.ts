import { createAdminClient } from '@/lib/supabase/admin';
import { IContratoRepository } from '@/core/domain/repositories/IContratoRepository';

export class SupabaseContratoRepository implements IContratoRepository {
  async guardarUrlPdfGenerado(contratoId: string, urlPdf: string): Promise<void> {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('contratos')
      .update({
        url_pdf_generado: urlPdf,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contratoId);

    if (error) {
      throw new Error(`Error al guardar contrato: ${error.message}`);
    }
  }

  async guardarUrlPdfFirmado(contratoId: string, urlPdf: string): Promise<void> {
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
      throw new Error(`Error al guardar contrato firmado: ${error.message}`);
    }
  }

  async obtenerDatosParaContrato(expedienteId: string, clienteId: string, contratoId: string): Promise<any> {
    const supabase = createAdminClient();

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
      .select('expediente_id, servicio_base, modulos_extra, monto_total, plan_pagos, url_pdf_generado')
      .eq('id', contratoId)
      .single();

    if (contError || !contratoData) throw new Error('No se encontró el contrato');

    return { expedienteData, perfilData, contratoData };
  }
}
