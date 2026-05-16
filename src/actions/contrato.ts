'use server';

import type { ActionResult } from '@/types/database';

// Importaciones de la Arquitectura Limpia
import { ContratoService } from '@/core/services/ContratoService';
import { SupabaseContratoRepository } from '@/infrastructure/persistence/SupabaseContratoRepository';
import { PdfGeneratorAdapter } from '@/infrastructure/pdf/PdfGeneratorAdapter';
import { CloudflareStorageService } from '@/infrastructure/storage/CloudflareStorageService';
import { OneSignalNotificationService } from '@/infrastructure/external/OneSignalNotificationService';

function getContratoService() {
  return new ContratoService(
    new SupabaseContratoRepository(),
    new PdfGeneratorAdapter(),
    new CloudflareStorageService(),
    new OneSignalNotificationService()
  );
}

/**
 * Guarda la URL del PDF generado automáticamente en el contrato.
 * (Mantenemos por compatibilidad directa si se necesita aislar)
 */
export async function guardarContratoGenerado(
  contratoId: string,
  urlPdf: string
): Promise<ActionResult> {
  try {
    const repo = new SupabaseContratoRepository();
    await repo.guardarUrlPdfGenerado(contratoId, urlPdf);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Guarda la URL del PDF firmado por el cliente.
 */
export async function guardarContratoFirmado(
  contratoId: string,
  urlPdf: string
): Promise<ActionResult> {
  const service = getContratoService();
  return await service.guardarContratoFirmado(contratoId, urlPdf);
}

/**
 * Genera el contrato automáticamente, lo sube a R2, guarda la URL y notifica.
 */
export async function generarContratoAutomatico(
  clienteId: string,
  expedienteId: string,
  contratoId: string
): Promise<ActionResult> {
  const service = getContratoService();
  return await service.generarContratoAutomatico(clienteId, expedienteId, contratoId);
}
