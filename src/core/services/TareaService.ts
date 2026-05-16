import { ITareaRepository } from '@/core/domain/repositories/ITareaRepository';
import { ActionResult } from '@/types/database';

export class TareaService {
  constructor(private tareaRepo: ITareaRepository) {}

  async marcarHitoCompletado(
    userId: string,
    expedienteId: string,
    hitoId: string,
    completado: boolean
  ): Promise<ActionResult> {
    try {
      const tienePermiso = await this.tareaRepo.verificarPermisoExpediente(expedienteId, userId);
      if (!tienePermiso) {
        return { success: false, error: 'No tienes permisos sobre este expediente.' };
      }

      await this.tareaRepo.marcarHito(expedienteId, parseInt(hitoId, 10), completado);
      return { success: true };
    } catch (error: any) {
      console.error('Error en TareaService.marcarHitoCompletado:', error);
      return { success: false, error: 'Ocurrió un error al actualizar el hito.' };
    }
  }

  async agregarNotaBitacora(
    userId: string,
    formData: FormData
  ): Promise<ActionResult> {
    try {
      const expedienteId = formData.get('expediente_id') as string;
      const nota = formData.get('nota') as string;
      const fechaProximo = formData.get('fecha_proximo_seguimiento') as string;
      const hora = formData.get('hora') as string | null;

      if (!expedienteId || !nota.trim() || !fechaProximo) {
        return { success: false, error: 'Faltan campos obligatorios.' };
      }

      const tienePermiso = await this.tareaRepo.verificarPermisoExpediente(expedienteId, userId);
      if (!tienePermiso) {
        return { success: false, error: 'No tienes permisos sobre este expediente.' };
      }

      await this.tareaRepo.agregarNotaBitacora(expedienteId, userId, nota, fechaProximo, hora);
      return { success: true };
    } catch (error: any) {
      console.error('Error en TareaService.agregarNotaBitacora:', error);
      return { success: false, error: 'Ocurrió un error al guardar la nota.' };
    }
  }
}
