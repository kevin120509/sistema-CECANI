'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { sendPushNotification } from '@/lib/onesignal-server';
import type { ActionResult, CrearExpedienteForm } from '@/types/database';

// Importaciones de la nueva arquitectura
import { ExpedienteService } from '@/core/services/ExpedienteService';
import { SupabaseExpedienteRepository } from '@/infrastructure/persistence/SupabaseExpedienteRepository';
import { SupabaseUserRepository } from '@/infrastructure/persistence/SupabaseUserRepository';

interface DatosPersonales {
  nombre_completo: string;
  telefono?: string;
  estado?: string;
  rfc?: string;
  curp?: string;
  ocupacion?: string;
  estado_civil?: string;
  domicilio_completo?: string;
  folio_ine?: string;
}

// Factoría rápida para el servicio (podría moverse a un archivo de configuración)
function getExpedienteService() {
  const expedienteRepo = new SupabaseExpedienteRepository();
  const userRepo = new SupabaseUserRepository();
  return new ExpedienteService(expedienteRepo, userRepo);
}

/**
 * Crea un expediente completo usando la Arquitectura Limpia.
 */
export async function crearExpedienteCompleto(
  datosPersonales: DatosPersonales,
  form: CrearExpedienteForm
): Promise<ActionResult<{ expediente_id: string; user_id: string }>> {
  const service = getExpedienteService();
  return service.registrarNuevoClienteConExpediente(datosPersonales, form);
}

/**
 * Actualiza el estatus de un expediente.
 * (Pendiente de mover a Service e Infrastructure)
 */
export async function actualizarEstatusExpediente(
  expedienteId: string,
  nuevoEstatus: string
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('expedientes')
      .update({ estatus: nuevoEstatus, updated_at: new Date().toISOString() })
      .eq('id', expedienteId);

    if (error) {
      return { success: false, error: `Error al actualizar estatus: ${error.message}` };
    }

    // DISPARADOR DE NOTIFICACIONES PARA DIRECTORAS
    if (nuevoEstatus === 'revision_directora' || nuevoEstatus === 'en_proceso') {
      const { data: directoras } = await supabase
        .from('perfiles')
        .select('id')
        .eq('rol', 'directora');

      if (directoras && directoras.length > 0) {
        const adminIds = directoras.map(d => d.id);
        
        let msg = '';
        if (nuevoEstatus === 'revision_directora') {
          msg = 'Un nuevo cliente ha completado su registro y subido sus documentos iniciales.';
        } else if (nuevoEstatus === 'en_proceso') {
          msg = 'Un cliente ha devuelto su contrato firmado junto con su comprobante de pago. Pendiente de asignación.';
        }

        await sendPushNotification({
          userIds: adminIds,
          title: 'Actualización de Expediente',
          message: msg,
          url: '/directora'
        });
      }
    }

    revalidatePath('/directora');
    revalidatePath('/abogada');
    revalidatePath('/');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Error inesperado: ${error instanceof Error ? error.message : 'Desconocido'}`,
    };
  }
}

/**
 * Obtiene los datos completos del dashboard.
 * (Pendiente de mover a Service e Infrastructure)
 */
export async function obtenerDashboardData(clienteId: string) {
  try {
    const supabase = createAdminClient();

    const [perfilResult, expedienteResult, figurasResult] = await Promise.all([
      supabase.from('perfiles').select('*').eq('id', clienteId).maybeSingle(),
      supabase.from('expedientes').select('*, contratos(*)').eq('cliente_id', clienteId).maybeSingle(),
      supabase.from('catalogo_figuras').select('*').order('id'),
    ]);

    let documentosData = [];
    if (expedienteResult.data?.id) {
      const docsReq = await supabase
        .from('documentos')
        .select('*')
        .eq('expediente_id', expedienteResult.data.id)
        .order('created_at', { ascending: true });
      documentosData = docsReq.data || [];
    }

    return {
      success: true,
      data: {
        perfil: perfilResult.data,
        expediente: expedienteResult.data,
        figuras: figurasResult.data || [],
        documentos: documentosData,
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Error inesperado al cargar datos: ${error instanceof Error ? error.message : 'Desconocido'}`
    };
  }
}

/**
 * Actualiza un expediente completo.
 * (Pendiente de mover a Service e Infrastructure)
 */
export async function actualizarExpedienteCompleto(
  userId: string,
  expedienteId: string,
  datosPersonales: DatosPersonales,
  form: CrearExpedienteForm
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();

    // 1. Actualizar perfil
    const { error: perfilError } = await supabase
      .from('perfiles')
      .update({
        nombre_completo: datosPersonales.nombre_completo.trim(),
        telefono: datosPersonales.telefono?.trim() || null,
        estado: datosPersonales.estado?.trim() || null,
        rfc: datosPersonales.rfc?.trim().toUpperCase() || null,
        curp: datosPersonales.curp?.trim().toUpperCase() || null,
        ocupacion: datosPersonales.ocupacion?.trim() || null,
        estado_civil: datosPersonales.estado_civil?.trim() || null,
        domicilio_completo: datosPersonales.domicilio_completo?.trim() || null,
        folio_ine: datosPersonales.folio_ine?.trim() || null,
      })
      .eq('id', userId);

    if (perfilError) {
      return { success: false, error: `Error al actualizar perfil: ${perfilError.message}` };
    }

    // 2. Actualizar user_metadata en auth.users
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        nombre_completo: datosPersonales.nombre_completo.trim(),
        telefono: datosPersonales.telefono?.trim() || '',
        estado: datosPersonales.estado?.trim() || '',
      }
    });

    // 3. Actualizar expediente
    const { error: expError } = await supabase
      .from('expedientes')
      .update({
        figura_id: form.figura_id,
        nombre_empresa: form.nombre_empresa.trim(),
        tipo_tramite: form.tipo_tramite,
        servicios_extra: form.servicios_extra || [],
      })
      .eq('id', expedienteId);

    if (expError) {
      return { success: false, error: `Error al actualizar expediente: ${expError.message}` };
    }

    // 4. Actualizar contrato (plan_pagos)
    const { error: contratoError } = await supabase
      .from('contratos')
      .update({
        plan_pagos: form.plan_pagos,
        monto_total: form.monto_total || 0,
        servicio_base: form.servicio_base,
        modulos_extra: form.modulos_extra,
      })
      .eq('expediente_id', expedienteId);

    if (contratoError) {
      return { success: false, error: `Error al actualizar contrato: ${contratoError.message}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Error inesperado: ${error instanceof Error ? error.message : 'Desconocido'}`,
    };
  }
}
