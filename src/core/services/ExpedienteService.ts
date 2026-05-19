import { 
  IExpedienteRepository, 
  IUserRepository 
} from '@/core/domain/repositories/IExpedienteRepository';
import { CrearExpedienteForm } from '@/types/database';
import { Result } from '@/core/domain/Result';
import { validateRFC, validateCURP } from '@/lib/validations';

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
  ): Promise<Result<{ expediente_id: string; user_id: string; contrato_id: string }>> {
    try {
      // 1. Validaciones de negocio (Lógica de dominio)
      const validacion = this.validarDatosBase(datosPersonales, form);
      if (!validacion.success) return validacion;

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
      await this.userRepo.actualizarPerfilLegal(userId, this.mapearPerfil(datosPersonales));

      // 4. Crear Expediente y Contrato
      const { expedienteId, contratoId } = await this.expedienteRepo.crearExpedienteConContrato(userId, form);

      return Result.ok({ expediente_id: expedienteId, user_id: userId, contrato_id: contratoId });
    } catch (error: any) {
      console.error('Error en ExpedienteService:', error);
      return Result.fail(error.message || 'Error inesperado al registrar el expediente');
    }
  }

  /**
   * Actualiza un expediente y perfil existente.
   */
  async actualizarExpedienteExistente(
    userId: string,
    expedienteId: string,
    datosPersonales: DatosPersonales,
    form: CrearExpedienteForm
  ): Promise<Result<null>> {
    try {
      // 1. Validaciones
      const validacion = this.validarDatosBase(datosPersonales, form);
      if (!validacion.success) return validacion;

      // 2. Actualizar perfil
      await this.userRepo.actualizarPerfilLegal(userId, this.mapearPerfil(datosPersonales));

      // 3. Actualizar expediente y contrato
      await this.expedienteRepo.actualizarExpedienteYContrato(expedienteId, form);

      return Result.ok(null);
    } catch (error: any) {
      console.error('Error en ExpedienteService (Update):', error);
      return Result.fail(error.message || 'Error inesperado al actualizar el expediente');
    }
  }

  /**
   * Permite a la dirección registrar un cliente manualmente.
   */
  async registrarClienteManual(
    datos: DatosPersonales,
    nombreEmpresa: string
  ): Promise<Result<{ expediente_id: string; user_id: string; contrato_id: string }>> {
    try {
      if (!datos.nombre_completo?.trim()) return Result.fail('Nombre requerido.');
      if (!nombreEmpresa.trim()) return Result.fail('Nombre de la empresa requerido.');

      const userId = await this.userRepo.crearUsuarioCliente({
        nombre: datos.nombre_completo.trim(),
        email: `manual_${Date.now()}@cecani.temp`,
        metadata: { telefono: datos.telefono || '' }
      });

      await this.userRepo.actualizarPerfilLegal(userId, this.mapearPerfil(datos));

      // Crear expediente con valores por defecto
      const { expedienteId, contratoId } = await this.expedienteRepo.crearExpedienteConContrato(userId, {
        nombre_empresa: nombreEmpresa,
        figura_id: 1, // SA de CV
        plan_pagos: 'unico',
        servicio_base: 'constitucion',
        modulos_extra: [],
        monto_total: 0
      });

      return Result.ok({ expediente_id: expedienteId, user_id: userId, contrato_id: contratoId });
    } catch (error: any) {
      return Result.fail(error.message || 'Error en registro manual');
    }
  }

  private validarDatosBase(datos: DatosPersonales, form: CrearExpedienteForm): Result<true> {
    if (!datos.nombre_completo?.trim()) return Result.fail('El nombre completo es requerido.');
    
    // Validar RFC
    if (!datos.rfc?.trim()) return Result.fail('El RFC es obligatorio para el contrato.');
    if (!validateRFC(datos.rfc)) return Result.fail('El formato del RFC no es válido.');

    // Validar CURP (opcional pero si se provee debe ser válida)
    if (datos.curp?.trim() && !validateCURP(datos.curp)) {
      return Result.fail('El formato de la CURP no es válido.');
    }

    if (!form.nombre_empresa?.trim()) return Result.fail('El nombre de la empresa es requerido.');
    if (!form.figura_id) return Result.fail('Selecciona un tipo de figura legal.');
    return Result.ok(true);
  }

  private mapearPerfil(datos: DatosPersonales) {
    return {
      nombre_completo: datos.nombre_completo.trim(),
      telefono: datos.telefono?.trim() || null,
      estado: datos.estado?.trim() || null,
      rfc: datos.rfc?.trim().toUpperCase() || null,
      curp: datos.curp?.trim().toUpperCase() || null,
      ocupacion: datos.ocupacion?.trim() || null,
      estado_civil: datos.estado_civil?.trim() || null,
      domicilio_completo: datos.domicilio_completo?.trim() || null,
      folio_ine: datos.folio_ine?.trim() || null,
    };
  }
}
