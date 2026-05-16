import { sendPushNotification, getIdsByRol } from '@/lib/onesignal-server';
import { INotificationService } from '@/core/domain/services/INotificationService';

export class OneSignalNotificationService implements INotificationService {
  async enviarNotificacionPush(
    userIds: string[],
    titulo: string,
    mensaje: string,
    url?: string
  ): Promise<void> {
    await sendPushNotification({
      userIds,
      title: titulo,
      message: mensaje,
      url,
    });
  }

  async obtenerIdsPorRol(rol: string): Promise<string[]> {
    return await getIdsByRol(rol as 'directora' | 'asesora' | 'cliente');
  }
}
