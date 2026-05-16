import { 
  IExpedienteRepository, 
  IUserRepository 
} from '@/core/domain/repositories/IExpedienteRepository';
import { CrearExpedienteForm, ActionResult } from '@/types/database';

interface DatosPersonales {
  nombre_completo: string;
  telefono?: string;
  estado?: string;
  rfc?: string;
  curp?: string;
  ocupacion?: string;
  estado_civil?: string;
  domicilio_completo?: string;
  folio_ine?: string;
}

export class ExpedienteService {
  constructor(
    private expedienteRepo: IExpedienteRepository,
    private userRepo: IUserRepository
  ) {}

  /**
   * Orquesta la creación completa de un expediente para un nuevo cliente.
   */
  async registrarNuevoClienteConExpediente(
    datosPersonales: DatosPersonales,
    form: CrearExpedienteForm
  ): Promise<ActionResult<{ expediente_id: string; user_id: string }>> {
    try {
      // 1. Validaciones de negocio (Lógica de dominio)
      if (!datosPersonales.nombre_completo?.trim()) {
        return { success: false, error: 'El nombre completo es requerido.' };
      }
      if (!datosPersonales.rfc?.trim()) {
        return { success: false, error: 'El RFC es obligatorio para el contrato.' };
      }

      // 2. Crear usuario Auth
      const nombre = datosPersonales.nombre_completo.trim();
      const fakeEmail = `${nombre.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20)}_${Date.now()}@cecani.temp`;

      const userId = await this.userRepo.crearUsuarioCliente({
        nombre,
        email: fakeEmail,
        metadata: {
          telefono: datosPersonales.telefono?.trim() || '',
          estado: datosPersonales.estado?.trim() || '',
          estado_civil: datosPersonales.estado_civil?.trim() || '',
        }
      });

      // 3. Actualizar perfil con datos legales
      await this.userRepo.actualizarPerfilLegal(userId, {
        telefono: datosPersonales.telefono?.trim() || null,
        estado: datosPersonales.estado?.trim() || null,
        rfc: datosPersonales.rfc?.trim().toUpperCase() || null,
        curp: datosPersonales.curp?.trim().toUpperCase() || null,
        ocupacion: datosPersonales.ocupacion?.trim() || null,
        estado_civil: datosPersonales.estado_civil?.trim() || null,
        domicilio_completo: datosPersonales.domicilio_completo?.trim() || null,
        folio_ine: datosPersonales.folio_ine?.trim() || null,
      });

      // 4. Crear Expediente y Contrato
      const { expedienteId } = await this.expedienteRepo.crearExpedienteConContrato(userId, form);

      return {
        success: true,
        data: { expediente_id: expedienteId, user_id: userId }
      };
    } catch (error: any) {
      console.error('Error en ExpedienteService:', error);
      return {
        success: false,
        error: error.message || 'Error inesperado al registrar el expediente'
      };
    }
  }
}
