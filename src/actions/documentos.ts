'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult, TipoDocumento } from '@/types/database';

// Importaciones de la Arquitectura Limpia
import { DocumentoService } from '@/core/services/DocumentoService';
import { SupabaseDocumentoRepository, SupabasePagoRepository } from '@/infrastructure/persistence/SupabaseDocumentosRepository';
import { CloudflareStorageService } from '@/infrastructure/storage/CloudflareStorageService';
import { OneSignalNotificationService } from '@/infrastructure/external/OneSignalNotificationService';
import { borrarArchivoR2 } from '@/lib/r2';
import { createAdminClient } from '@/lib/supabase/admin';

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
  urlArchivo: string,
  integranteId?: string | null
): Promise<ActionResult<{ documento_id: string }>> {
  // Mapeo preventivo para evitar errores de enum en base de datos legacy
  const enumsValidos = [
    'ine_frente', 'ine_reverso', 'comprobante_domicilio', 'contrato_firmado', 
    'comprobante_pago', 'curp', 'csf', 'efirma_representante', 
    'propuestas_nombre', 'autorizacion_nombre', 'acta_asamblea', 
    'proyecto_word', 'testimonio_notarial', 'acuse_cita_sat', 
    'rfc_moral', 'constancia_acreditacion', 'oficio_donataria', 
    'inscripcion_rpp', 'otro'
  ];

  const tipoFinal = enumsValidos.includes(tipo) ? tipo : 'otro' as TipoDocumento;

  const service = getDocumentoService();
  const result = await service.registrarDocumentoYNotificar(expedienteId, tipoFinal, urlArchivo, integranteId);

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


/**
 * Elimina un documento de R2 y de la base de datos.
 */
export async function eliminarDocumentoAction(documentoId: string, urlArchivo: string): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();

    // 1. Borrar de R2
    await borrarArchivoR2(urlArchivo);

    // 2. Borrar de la DB
    const { error } = await supabase
      .from('documentos')
      .delete()
      .eq('id', documentoId);

    if (error) throw error;

    revalidatePath('/directora');
    revalidatePath('/abogada');
    revalidatePath('/');

    return { success: true };
  } catch (error: any) {
    console.error('Error en eliminarDocumentoAction:', error);
    return { success: false, error: error.message };
  }
}