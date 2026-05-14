'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { subirArchivoR2 } from '@/lib/r2';
import { revalidatePath } from 'next/cache';
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

    revalidatePath('/directora');
    revalidatePath('/abogada');
    revalidatePath('/');

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

    revalidatePath('/directora');
    revalidatePath('/abogada');
    revalidatePath('/');

    return { success: true, data: { pago_id: data.id } };
  } catch (error) {
    return {
      success: false,
      error: `Error inesperado: ${error instanceof Error ? error.message : 'Desconocido'}`,
    };
  }
}

/**
 * Server Action Híbrido:
 * 1. Sube el comprobante a Cloudflare R2.
 * 2. Registra el pago en la tabla 'pagos'.
 * 3. Registra el documento en la tabla 'documentos' para visibilidad en el panel.
 */
export async function subirYRegistrarPago(
  formData: FormData,
  expedienteId: string,
  monto: number,
  nombreEmpresa: string
): Promise<ActionResult> {
  try {
    const file = formData.get('file') as File;
    if (!file || file.size === 0) {
      return { success: false, error: 'No se proporcionó el archivo del comprobante.' };
    }

    // 1. Subir a R2
    const carpetaEmpresa = nombreEmpresa
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    const extension = file.name.split('.').pop() || 'bin';
    const nuevoNombre = `Comprobante_Pago_${carpetaEmpresa}.${extension}`;
    const fileRenombrado = new File([file], nuevoNombre, { type: file.type });
    
    const urlPublicaR2 = await subirArchivoR2(fileRenombrado, `expedientes/${carpetaEmpresa}/documentacion`);

    // 2. Registrar Pago
    const resPago = await registrarPago(expedienteId, monto, urlPublicaR2);
    if (!resPago.success) throw new Error(resPago.error);

    // 3. Registrar Documento (para visibilidad en dashboard)
    await registrarDocumento(expedienteId, 'comprobante_pago' as TipoDocumento, urlPublicaR2);

    return { success: true };
  } catch (error) {
    console.error('Error en subirYRegistrarPago:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar el pago',
    };
  }
}
