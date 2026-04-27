'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionResult } from '@/types/database';

/**
 * Sanitiza el nombre de un archivo para almacenamiento.
 */
function sanitizarNombreArchivo(originalName: string): string {
  const extension = originalName.split('.').pop()?.toLowerCase() || 'bin';
  const baseName = originalName
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 100);

  return `${baseName}.${extension}`;
}

/**
 * Sube un archivo a Supabase Storage y retorna la URL pública.
 */
export async function subirArchivo(
  bucket: string,
  carpetaUsuario: string,
  formData: FormData
): Promise<ActionResult<{ url: string }>> {
  try {
    const supabase = createAdminClient();

    const file = formData.get('file') as File | null;

    if (!file || file.size === 0) {
      return { success: false, error: 'No se proporcionó un archivo válido.' };
    }

    // Validar tamaño máximo (10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return {
        success: false,
        error: 'El archivo excede el tamaño máximo de 10MB.',
      };
    }

    // Validar tipos de archivo permitidos
    const tiposPermitidos = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/jpg',
    ];
    if (!tiposPermitidos.includes(file.type)) {
      return {
        success: false,
        error: 'Tipo de archivo no permitido. Solo se aceptan PDF, JPG, PNG y WebP.',
      };
    }

    const nombreSanitizado = sanitizarNombreArchivo(file.name);
    const filePath = `${carpetaUsuario}/${nombreSanitizado}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return {
        success: false,
        error: `Error al subir archivo: ${uploadError.message}`,
      };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(filePath);

    return { success: true, data: { url: publicUrl } };
  } catch (error) {
    return {
      success: false,
      error: `Error inesperado: ${error instanceof Error ? error.message : 'Desconocido'}`,
    };
  }
}
