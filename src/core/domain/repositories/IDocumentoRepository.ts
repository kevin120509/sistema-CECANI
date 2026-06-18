import { TipoDocumento } from '@/types/database';

export interface IDocumentoRepository {
  registrarDocumento(
    expedienteId: string,
    tipo: TipoDocumento,
    urlArchivo: string,
    integranteId?: string | null,
    nombrePersonalizado?: string,
    validado?: boolean,
    oldName?: string
  ): Promise<string>;
}

export interface IPagoRepository {
  registrarPago(
    expedienteId: string,
    monto: number,
    urlComprobante: string,
    esPagoInicial: boolean
  ): Promise<string>;
}
