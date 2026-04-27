'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionResult, TipoDocumento } from '@/types/database';

import { sendPushNotification, getIdsByRol } from '@/lib/onesignal-server';

/**
 * Registra un documento en la base de datos.
 */
export async function registrarDocumento(
  expedienteId: string,
  tipo: TipoDocumento,
  urlArchivo: string
): Promise<ActionResult<{ documento_id: string }>> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('documentos')
      .insert({
        expediente_id: expedienteId,
        tipo,
        url_archivo: urlArchivo,
      })
      .select('id')
      .single();

    if (error || !data) {
      return {
        success: false,
        error: `Error al registrar documento: ${error?.message}`,
      };
    }

    // NOTIFICACIÓN A LA DIRECTORA
    const directoras = await getIdsByRol('directora');
    if (directoras.length > 0) {
      await sendPushNotification({
        userIds: directoras,
        title: 'Nuevo Documento Recibido',
        message: `Se ha subido un nuevo documento (${tipo}) para el expediente #${expedienteId.slice(-6)}.`,
        url: `/directora/expediente/${expedienteId}`
      });
    }

    return { success: true, data: { documento_id: data.id } };
  } catch (error) {
    return {
      success: false,
      error: `Error inesperado: ${error instanceof Error ? error.message : 'Desconocido'}`,
    };
  }
}

/**
 * Registra un pago inicial en la base de datos.
 */
export async function registrarPago(
  expedienteId: string,
  monto: number,
  urlComprobante: string
): Promise<ActionResult<{ pago_id: string }>> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('pagos')
      .insert({
        expediente_id: expedienteId,
        monto,
        fecha_pago: new Date().toISOString().split('T')[0],
        url_comprobante: urlComprobante,
        es_pago_inicial: true,
      })
      .select('id')
      .single();

    if (error || !data) {
      return {
        success: false,
        error: `Error al registrar pago: ${error?.message}`,
      };
    }

    // NOTIFICACIÓN A LA DIRECTORA
    const directoras = await getIdsByRol('directora');
    if (directoras.length > 0) {
      await sendPushNotification({
        userIds: directoras,
        title: '¡Pago Recibido!',
        message: `Un cliente ha registrado un pago de $${monto} para el expediente #${expedienteId.slice(-6)}.`,
        url: `/directora/expediente/${expedienteId}`
      });
    }

    return { success: true, data: { pago_id: data.id } };
  } catch (error) {
    return {
      success: false,
      error: `Error inesperado: ${error instanceof Error ? error.message : 'Desconocido'}`,
    };
  }
}
