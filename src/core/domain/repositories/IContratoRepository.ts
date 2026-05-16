export interface IContratoRepository {
  guardarUrlPdfGenerado(contratoId: string, urlPdf: string): Promise<void>;
  guardarUrlPdfFirmado(contratoId: string, urlPdf: string): Promise<void>;
  obtenerDatosParaContrato(expedienteId: string, clienteId: string, contratoId: string): Promise<any>;
}
