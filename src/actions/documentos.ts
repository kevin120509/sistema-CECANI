'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult, TipoDocumento } from '@/types/database';

// Importaciones de la Arquitectura Limpia
import { DocumentoService } from '@/core/services/DocumentoService';
import { SupabaseDocumentoRepository, SupabasePagoRepository } from '@/infrastructure/persistence/SupabaseDocumentosRepository';
import { CloudflareStorageService } from '@/infrastructure/storage/CloudflareStorageService';
import { OneSignalNotificationService } from '@/infrastructure/external/OneSignalNotificationService';

function getDocumentoService() {
  return new DocumentoService(
    new SupabaseDocumentoRepository(),
    new SupabasePagoRepository(),
    new CloudflareStorageService(),
    new OneSignalNotificationService()
  );
}

/**
 * Registra un documento en la base de datos y notifica.
 */
export async function registrarDocumento(
  expedienteId: string,
  tipo: TipoDocumento,
  urlArchivo: string
): Promise<ActionResult<{ documento_id: string }>> {
  const service = getDocumentoService();
  const result = await service.registrarDocumentoYNotificar(expedienteId, tipo, urlArchivo);

  if (result.success) {
    revalidatePath('/directora');
    revalidatePath('/abogada');
    revalidatePath('/');
  }

  return result;
}

/**
 * Registra un pago inicial en la base de datos y notifica.
 * (Mantenemos la firma para compatibilidad, pero lo delega al Service).
 */
export async function registrarPago(
  expedienteId: string,
  monto: number,
  urlComprobante: string
): Promise<ActionResult<{ pago_id: string }>> {
  try {
    const pagoRepo = new SupabasePagoRepository();
    const pagoId = await pagoRepo.registrarPago(expedienteId, monto, urlComprobante, true);

    const notificationService = new OneSignalNotificationService();
    const directoras = await notificationService.obtenerIdsPorRol('directora');
    if (directoras.length > 0) {
      await notificationService.enviarNotificacionPush(
        directoras,
        '¡Pago Recibido!',
        `Un cliente ha registrado un pago de $${monto} para el expediente #${expedienteId.slice(-6)}.`,
        `/directora/expediente/${expedienteId}`
      );
    }

    revalidatePath('/directora');
    revalidatePath('/abogada');
    revalidatePath('/');

    return { success: true, data: { pago_id: pagoId } };
  } catch (error: any) {
    return { success: false, error: error.message };
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
  const file = formData.get('file') as File;
  const service = getDocumentoService();
  
  const result = await service.subirYRegistrarPagoInicial(file, expedienteId, monto, nombreEmpresa);

  if (result.success) {
    revalidatePath('/directora');
    revalidatePath('/abogada');
    revalidatePath('/');
    return { success: true };
  }

  return { success: false, error: result.error };
}
