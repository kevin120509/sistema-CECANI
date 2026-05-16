export interface INotificationService {
  /**
   * Envia una notificación push a una lista de IDs de usuario
   */
  enviarNotificacionPush(
    userIds: string[],
    titulo: string,
    mensaje: string,
    url?: string
  ): Promise<void>;

  /**
   * Obtiene los IDs de los usuarios según su rol
   */
  obtenerIdsPorRol(rol: string): Promise<string[]>;
}
