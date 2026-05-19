import { PlanPagos } from '@/types/database';

export interface DatosContratoPDF {
  nombreEmpresa: string;
  nombreRepresentante: string;
  figuraLegal: string;
  servicioBaseId: string;
  modulosExtraIds: string[];
  montoTotal: number;
  planPagos: PlanPagos;
  rfc: string | null;
  curp: string | null;
  ocupacion: string | null;
  estadoCivil: string | null;
  domicilioCompleto: string | null;
  tipoContrato?: 'legal' | 'contabilidad';
  observacionesPago?: string | null;
}

export interface IPdfService {
  generarContrato(datos: DatosContratoPDF): Promise<Uint8Array>;
}
