import { IContratoRepository } from '@/core/domain/repositories/IContratoRepository';
import { IPdfService, DatosContratoPDF } from '@/core/domain/services/IPdfService';
import { IStorageService } from '@/core/domain/services/IStorageService';
import { INotificationService } from '@/core/domain/services/INotificationService';
import { ActionResult } from '@/types/database';

export class ContratoService {
  constructor(
    private contratoRepo: IContratoRepository,
    private pdfService: IPdfService,
    private storageService: IStorageService,
    private notificationService: INotificationService
  ) {}

  /**
   * Genera el contrato en PDF y lo guarda en R2.
   */
  async generarContratoAutomatico(
    clienteId: string,
    expedienteId: string,
    contratoId: string
  ): Promise<ActionResult> {
    try {
      // 1. Obtener datos
      const { expedienteData, perfilData, contratoData } = 
        await this.contratoRepo.obtenerDatosParaContrato(expedienteId, clienteId, contratoId);

      // 2. Generar PDF
      const datosPdf: DatosContratoPDF = {
        nombreEmpresa: expedienteData.nombre_empresa,
        nombreRepresentante: perfilData.nombre_completo,
        figuraLegal: expedienteData.figura?.descripcion || 'Figura Legal',
        servicioBaseId: contratoData.servicio_base || '',
        modulosExtraIds: contratoData.modulos_extra || [],
        montoTotal: contratoData.monto_total || 0,
        planPagos: contratoData.plan_pagos,
        rfc: perfilData.rfc,
        curp: perfilData.curp,
        ocupacion: perfilData.ocupacion,
        estadoCivil: perfilData.estado_civil,
        domicilioCompleto: perfilData.domicilio_completo,
        tipoContrato: contratoData.tipo_contrato as any,
        observacionesPago: contratoData.observaciones_pago,
      };

      const pdfBuffer = await this.pdfService.generarContrato(datosPdf);

      // 3. Subir a R2
      const carpetaEmpresa = expedienteData.nombre_empresa.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
      const timestamp = Date.now();
      const fileName = `${timestamp}_CONTRATO_OFICIAL_${carpetaEmpresa}.pdf`;
      
      const urlPublicaR2 = await this.storageService.subirBuffer(
        pdfBuffer,
        'application/pdf',
        `expedientes/${carpetaEmpresa}/contratos/${fileName}`
      );

      // 4. Actualizar base de datos
      await this.contratoRepo.guardarUrlPdfGenerado(contratoId, urlPublicaR2);

      // 5. Notificar a directora
      const directoras = await this.notificationService.obtenerIdsPorRol('directora');
      if (directoras.length > 0) {
        await this.notificationService.enviarNotificacionPush(
          directoras,
          'Nuevo Cliente Registrado',
          `El cliente del expediente "${expedienteData.nombre_empresa}" ha completado su registro y se ha generado su contrato.`,
          '/directora'
        );
      }


      return { success: true };
    } catch (error: any) {
      console.error('Error en ContratoService.generarContratoAutomatico:', error);
      return { success: false, error: error.message || 'Error al generar contrato' };
    }
  }

  /**
   * Guarda el contrato firmado por el cliente.
   */
  async guardarContratoFirmado(
    contratoId: string,
    urlPdf: string
  ): Promise<ActionResult> {
    try {
      await this.contratoRepo.guardarUrlPdfFirmado(contratoId, urlPdf);

      // Notificar a directora
      const directoras = await this.notificationService.obtenerIdsPorRol('directora');
      if (directoras.length > 0) {
        await this.notificationService.enviarNotificacionPush(
          directoras,
          'Contrato Firmado Recibido',
          `Un cliente ha subido su contrato firmado.`,
          '/directora'
        );
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error en ContratoService.guardarContratoFirmado:', error);
      return { success: false, error: error.message || 'Error al guardar contrato firmado' };
    }
  }
}
