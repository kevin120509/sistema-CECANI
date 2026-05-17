import { Expediente, Perfil, Contrato, CrearExpedienteForm } from '@/types/database';

export interface IExpedienteRepository {
  /**
   * Crea un expediente y su contrato asociado en una transacción (o secuencia)
   */
  crearExpedienteConContrato(
    perfilId: string,
    form: CrearExpedienteForm
  ): Promise<{ expedienteId: string; contratoId: string }>;

  /**
   * Busca un expediente por ID
   */
  obtenerPorId(id: string): Promise<Expediente | null>;

  /**
   * Busca el expediente de un cliente específico
   */
  obtenerPorClienteId(clienteId: string): Promise<Expediente | null>;

  /**
   * Actualiza un expediente y su contrato asociado
   */
  actualizarExpedienteYContrato(
    expedienteId: string,
    form: CrearExpedienteForm
  ): Promise<void>;
}

export interface IUserRepository {
  /**
   * Crea un usuario en el sistema de autenticación y su perfil base
   */
  crearUsuarioCliente(datos: {
    nombre: string;
    email: string;
    metadata: any;
  }): Promise<string>;

  /**
   * Actualiza los datos legales del perfil de un usuario
   */
  actualizarPerfilLegal(userId: string, datos: Partial<Perfil>): Promise<void>;
}
