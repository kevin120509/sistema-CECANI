import type { IRecordatorioRepository } from '@/core/domain/repositories/IRecordatorioRepository';
import type { INotificationService } from '@/core/domain/services/INotificationService';
import type { ActionResult, CrearRecordatorioForm, Recordatorio, EstatusRecordatorio } from '@/types/database';

export class RecordatorioService {
  constructor(
    private recordatorioRepo: IRecordatorioRepository,
    private notificationService: INotificationService
  ) {}

  async crearRecordatorio(
    userId: string,
    form: CrearRecordatorioForm,
    nombreAbogada: string
  ): Promise<ActionResult<Recordatorio>> {
    try {
      const tienePermiso = await this.recordatorioRepo.verificarPermisoExpediente(
        form.expediente_id,
        userId
      );
      if (!tienePermiso) {
        return { success: false, error: 'No tienes permisos sobre este expediente.' };
      }

      const recordatorio = await this.recordatorioRepo.crear(form, userId);

      // Notificación push a la abogada si lo pidió
      if (form.notificar_abogada) {
        try {
          const fechaFormateada = new Date(form.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          });
          await this.notificationService.enviarNotificacionPush(
            [userId],
            `📅 Recordatorio programado`,
            `${form.titulo} — ${fechaFormateada}${form.hora ? ' a las ' + form.hora.substring(0, 5) + ' hrs' : ''}`,
            '/abogada'
          );
          await this.recordatorioRepo.marcarPushEnviado(recordatorio.id);
        } catch {
          // La notificación falla silenciosamente, el recordatorio ya fue creado
        }
      }

      return { success: true, data: recordatorio };
    } catch (error: any) {
      console.error('Error en RecordatorioService.crearRecordatorio:', error);
      return { success: false, error: 'Ocurrió un error al crear el recordatorio.' };
    }
  }

  async actualizarEstatus(
    userId: string,
    recordatorioId: string,
    expedienteId: string,
    estatus: EstatusRecordatorio
  ): Promise<ActionResult> {
    try {
      const tienePermiso = await this.recordatorioRepo.verificarPermisoExpediente(
        expedienteId,
        userId
      );
      if (!tienePermiso) {
        return { success: false, error: 'No tienes permisos.' };
      }
      await this.recordatorioRepo.actualizarEstatus(recordatorioId, estatus);
      return { success: true };
    } catch (error: any) {
      console.error('Error en RecordatorioService.actualizarEstatus:', error);
      return { success: false, error: 'Error al actualizar el estatus.' };
    }
  }
}
