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
