import { IDocumentoRepository, IPagoRepository } from '@/core/domain/repositories/IDocumentoRepository';
import { IStorageService } from '@/core/domain/services/IStorageService';
import { INotificationService } from '@/core/domain/services/INotificationService';
import { TipoDocumento, ActionResult } from '@/types/database';

export class DocumentoService {
  constructor(
    private documentoRepo: IDocumentoRepository,
    private pagoRepo: IPagoRepository,
    private storageService: IStorageService,
    private notificationService: INotificationService
  ) {}

  /**
   * Registra un documento, lo guarda en la DB y notifica a la directora
   */
  async registrarDocumentoYNotificar(
    expedienteId: string,
    tipo: TipoDocumento,
    urlArchivo: string,
    integranteId?: string | null,
    nombrePersonalizado?: string
  ): Promise<ActionResult<{ documento_id: string }>> {
    try {
      const documentoId = await this.documentoRepo.registrarDocumento(expedienteId, tipo, urlArchivo, integranteId, nombrePersonalizado);

      // Notificar a directoras
      const directoras = await this.notificationService.obtenerIdsPorRol('directora');
      if (directoras.length > 0) {
        await this.notificationService.enviarNotificacionPush(
          directoras,
          'Nuevo Documento Recibido',
          `Se ha subido un nuevo documento (${tipo}) para el expediente #${expedienteId.slice(-6)}.`,
          `/directora/expediente/${expedienteId}`
        );
      }

      return { success: true, data: { documento_id: documentoId } };
    } catch (error: any) {
      console.error('Error en DocumentoService.registrarDocumentoYNotificar:', error);
      return { success: false, error: error.message || 'Error al registrar documento' };
    }
  }

  /**
   * Sube a R2, registra el pago en DB y registra el documento.
   */
  async subirYRegistrarPagoInicial(
    file: File,
    expedienteId: string,
    monto: number,
    nombreEmpresa: string
  ): Promise<ActionResult<{ pago_id: string, url: string }>> {
    try {
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
      
      const urlPublicaR2 = await this.storageService.subirArchivo(
        fileRenombrado,
        `expedientes/${carpetaEmpresa}/documentacion`
      );

      // 2. Registrar Pago
      const pagoId = await this.pagoRepo.registrarPago(expedienteId, monto, urlPublicaR2, true);

      // 3. Registrar Documento (para visibilidad en dashboard)
      await this.documentoRepo.registrarDocumento(expedienteId, 'comprobante_pago', urlPublicaR2);

      // 4. Notificar
      const directoras = await this.notificationService.obtenerIdsPorRol('directora');
      if (directoras.length > 0) {
        await this.notificationService.enviarNotificacionPush(
          directoras,
          '¡Pago Recibido!',
          `Un cliente ha registrado un pago de $${monto} para el expediente #${expedienteId.slice(-6)}.`,
          `/directora/expediente/${expedienteId}`
        );
      }

      return { success: true, data: { pago_id: pagoId, url: urlPublicaR2 } };
    } catch (error: any) {
      console.error('Error en DocumentoService.subirYRegistrarPagoInicial:', error);
      return { success: false, error: error.message || 'Error al procesar el pago' };
    }
  }

  /**
   * Sube un documento genérico a R2 y lo registra en la DB
   */
  async subirYGuardarDocumento(
    file: File,
    expedienteId: string,
    tipoDocumento: TipoDocumento = 'otro'
  ): Promise<ActionResult<{ url: string }>> {
    try {
      if (!file || file.size === 0) {
        return { success: false, error: 'No se proporcionó un archivo válido.' };
      }

      const urlArchivoR2 = await this.storageService.subirArchivo(file, 'expedientes');
      
      await this.documentoRepo.registrarDocumento(expedienteId, tipoDocumento, urlArchivoR2);

      return { success: true, data: { url: urlArchivoR2 } };
    } catch (error: any) {
      console.error('Error en DocumentoService.subirYGuardarDocumento:', error);
      return { success: false, error: error.message || 'Error al procesar el documento' };
    }
  }
}
