'use server';

import { revalidatePath } from 'next/cache';
import { ActionResult } from '@/types/database';

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
 * Server Action genérico para subir un archivo a R2.
 */
export async function subirArchivoR2Action(
  formData: FormData,
  carpeta: string
): Promise<ActionResult<{ url: string }>> {
  try {
    const file = formData.get('file') as File;
    if (!file || file.size === 0) {
      return { success: false, error: 'No se proporcionó un archivo válido.' };
    }

    const storage = new CloudflareStorageService();
    const url = await storage.subirArchivo(file, carpeta);
    return { success: true, data: { url } };
  } catch (error) {
    console.error('Error en subirArchivoR2Action:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al subir a R2',
    };
  }
}

/**
 * Server Action Híbrido:
 * 1. Sube el archivo a Cloudflare R2 (Bodega).
 * 2. Guarda la URL y metadatos en Supabase (Archivero).
 */
export async function guardarDocumentoExpediente(formData: FormData) {
  try {
    const archivo = formData.get('ine_cliente') as File;
    const expedienteId = formData.get('id_expediente') as string;
    
    if (!archivo || archivo.size === 0) {
      throw new Error('No se adjuntó ningún archivo o el archivo está vacío');
    }

    if (!expedienteId) {
      throw new Error('ID de expediente no proporcionado');
    }

    const service = getDocumentoService();
    const result = await service.subirYGuardarDocumento(archivo, expedienteId, 'otro');

    if (!result.success) {
        throw new Error(result.error);
    }

    revalidatePath('/documentacion'); 
    revalidatePath(`/abogada`); 

    return { success: true, url: result.data?.url };
  } catch (error: any) {
    console.error('Error en guardarDocumentoExpediente:', error);
    return { success: false, error: error.message || 'Error desconocido al procesar el documento' };
  }
}
