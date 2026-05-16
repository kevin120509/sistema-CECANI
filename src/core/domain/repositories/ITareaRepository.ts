export interface ITareaRepository {
  marcarHito(expedienteId: string, hitoId: number, completado: boolean): Promise<void>;
  agregarNotaBitacora(
    expedienteId: string,
    autorId: string,
    nota: string,
    fechaProximo: string,
    hora: string | null
  ): Promise<void>;
  verificarPermisoExpediente(expedienteId: string, asesoraId: string): Promise<boolean>;
}
