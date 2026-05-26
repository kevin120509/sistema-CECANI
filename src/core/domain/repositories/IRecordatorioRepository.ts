import type { Recordatorio, CrearRecordatorioForm, EstatusRecordatorio, RecordatorioConRelaciones } from '@/types/database';

export interface IRecordatorioRepository {
  crear(form: CrearRecordatorioForm, creadoPor: string): Promise<Recordatorio>;
  obtenerPorExpediente(expedienteId: string): Promise<Recordatorio[]>;
  obtenerPorFecha(fecha: string): Promise<RecordatorioConRelaciones[]>;
  actualizarEstatus(id: string, estatus: EstatusRecordatorio): Promise<void>;
  marcarPushEnviado(id: string): Promise<void>;
  marcarWhatsappEnviado(id: string): Promise<void>;
  verificarPermisoExpediente(expedienteId: string, userId: string): Promise<boolean>;
}
