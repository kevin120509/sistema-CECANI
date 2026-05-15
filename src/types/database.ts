// ============================
// Enums - Basados en el esquema PostgreSQL
// ============================

export type EstatusExpediente =
  | 'en_registro'
  | 'revision_directora'
  | 'en_proceso'
  | 'completado'
  | 'rechazado';

export type TipoTramite = 'CONSTITUCION' | 'EXTRAORDINARIA' | 'RECUPERACION';

export type PlanPagos = 'unico' | '2_meses' | '4_meses';

export type TipoDocumento =
  | 'ine_frente'
  | 'ine_reverso'
  | 'comprobante_domicilio'
  | 'contrato_firmado'
  | 'comprobante_pago'
  | 'otro';

export type EstatusContrato = 'generado' | 'firmado_cliente' | 'doble_firma' | 'vigente';

export type RolUsuario = 'cliente' | 'asesora' | 'directora' | 'admin';

export type EstatusTarea = 'pendiente' | 'en_progreso' | 'completada';

// ============================
// Interfaces - Tablas principales
// ============================

export interface CatalogoFigura {
  id: number;
  siglas: string;
  descripcion: string;
}
export interface Perfil {
  id: string;
  rol: RolUsuario;
  nombre_completo: string;
  telefono: string | null;
  estado: string | null;
  rfc: string | null;
  curp: string | null;
  ocupacion: string | null;
  estado_civil: string | null;
  domicilio_completo: string | null;
  folio_ine: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expediente {
  id: string;
  cliente_id: string;
  asesora_id: string | null;
  figura_id: number;
  nombre_empresa: string;
  estatus: EstatusExpediente;
  tipo_tramite?: TipoTramite;
  servicios_extra?: string[];
  created_at: string;
  updated_at: string;

  // Relaciones (Opcionales)
  perfil?: Perfil;
  figura?: CatalogoFigura;
  contratos?: Contrato[];
  documentos?: Documento[];
}

export interface Contrato {
  id: string;
  expediente_id: string;
  plan_pagos: PlanPagos;
  monto_total: number;
  servicio_base?: string;
  modulos_extra?: string[];
  url_pdf_generado: string | null;
  url_pdf_firmado_cliente: string | null;
  url_pdf_doble_firma: string | null;
  estatus: EstatusContrato;
  created_at: string;
  updated_at: string;
}

export interface Documento {
  id: string;
  expediente_id: string;
  tipo: TipoDocumento;
  url_archivo: string;
  validado: boolean;
  created_at: string;
}

export interface Pago {
  id: string;
  expediente_id: string;
  monto: number;
  fecha_pago: string;
  url_comprobante: string;
  es_pago_inicial: boolean;
  verificado: boolean;
  created_at: string;
}

// ============================
// Tipos compuestos para consultas con JOINs
// ============================

export interface ExpedienteConContrato extends Expediente {
  contratos: Contrato[];
}

export interface DashboardData {
  perfil: Perfil | null;
  expediente: Expediente | null;
  contrato: Contrato | null;
  documentos: Documento[];
  figuras: CatalogoFigura[];
}

export interface CatalogoHito {
  id: string;
  nombre: string;
  descripcion?: string;
  orden: number;
  created_at: string;
}

export interface SeguimientoTarea {
  id: string;
  expediente_id: string;
  hito_id: string;
  estatus: 'pendiente' | 'completado';
  fecha_completado: string | null;
  created_at: string;
}

export interface Bitacora {
  id: string;
  expediente_id: string;
  autor_id: string;
  nota: string;
  hora: string | null;
  fecha_proximo_seguimiento: string;
  created_at: string;
}

export interface HitoConEstatus extends CatalogoHito {
  seguimiento: SeguimientoTarea | null;
}

export interface NotaBitacora extends Bitacora {
  autor: { nombre_completo: string };
}

export interface DatosConcentrado {
  id?: string;
  expediente_id: string;
  asesora_encargada: string;
  estado: string;
  actividad: string;
  cluni: string;
  estatus_rpp: string;
  notaria: string;
  pago_notario: string;
  total_contrato: string;
  periodicidad_pagos: string;
  pago_entrega_donataria: string;
  cantidad_cobrar_proximo: string;
  estatus_detalle: string;
  accion_realizar: string;
  num_pagos_realizados: string;
  cantidad_pagada_acumulada: string;
  saldo_cliente: string;
  fecha_ultimo_pago: string;
  quien_cobra: string;
  vendedora: string;
  telefono_cliente: string;
  fecha_contrato: string;
  link_reunion: string;
  fecha_reunion_acuerdos: string;
}

export interface ExpedienteAvanzado extends Expediente {
  // Las relaciones base ya están en Expediente, 
  // aquí extendemos con relaciones adicionales específicas de vistas complejas
  pagos?: Pago[];
  seguimiento_tareas?: SeguimientoTarea[];
  bitacora?: NotaBitacora[];
  datos_concentrado?: DatosConcentrado[];
}

// ============================
// Tipos para formularios
// ============================

export interface CrearExpedienteForm {
  nombre_empresa: string;
  figura_id: number;
  plan_pagos: PlanPagos;
  servicio_base?: string;
  modulos_extra?: string[];
  monto_total?: number;
  tipo_tramite?: TipoTramite;
  servicios_extra?: string[];
}

export interface SubirDocumentosForm {
  ine_frente: File | null;
  ine_reverso: File | null;
  comprobante_domicilio: File | null;
  contrato_firmado: File | null;
  comprobante_pago: File | null;
  monto_pago: number;
}

// ============================
// Tipo de respuesta genérico para Server Actions
// ============================

export interface ActionResult<T = null> {
  success: boolean;
  data?: T;
  error?: string;
}
