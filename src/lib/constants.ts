/**
 * Catálogo de servicios y precios base de CECANI Latinoamérica.
 * Basado en las cotizaciones y contratos oficiales de Mayo 2026.
 */

export interface ServicioBase {
  id: string;
  nombre: string;
  precioEspecial: number; // Pago de contado
  precioLista: number;    // Precio normal
  descripcion: string;
}

export interface ServicioExtra {
  id: string;
  nombre: string;
  precio: number;
  esRegalo?: boolean;
  precioVariable?: boolean;
  descripcion: string;
}

export const SERVICIOS_PRINCIPALES: Record<string, ServicioBase> = {
  CONSTITUCION: {
    id: 'constitucion',
    nombre: 'Constitución de A.C. + Trámite de Donataria',
    precioEspecial: 49500,
    precioLista: 75000,
    descripcion: 'Creación de asociación civil desde cero con registro ante el SAT.'
  },
  ACTA_EXTRAORDINARIA: {
    id: 'acta_extra',
    nombre: 'Acta Extraordinaria + Donataria',
    precioEspecial: 49500,
    precioLista: 70000,
    descripcion: 'Actualización de estatutos para asociaciones existentes.'
  },
  RECUPERACION_DONATARIA: {
    id: 'recuperacion',
    nombre: 'Recuperación de Donataria Autorizada',
    precioEspecial: 35000,
    precioLista: 35000,
    descripcion: 'Trámite para recuperar el estatus de donataria perdido.'
  },
  RENOVACION_CONSTANCIA: {
    id: 'renovacion',
    nombre: 'Renovación de Constancia y Donataria',
    precioEspecial: 38000,
    precioLista: 44000,
    descripcion: 'Mantenimiento anual del estatus de donataria.'
  }
};

export const SERVICIOS_EXTRAS: Record<string, ServicioExtra> = {
  TRAMITE_CLUNI: {
    id: 'cluni',
    nombre: 'Trámite de CLUNI desde cero',
    precio: 11600,
    descripcion: 'Obtención de la Clave Única de Inscripción ante el Registro Federal.'
  },
  PAGINA_WEB: {
    id: 'web',
    nombre: 'Página Web Profesional',
    precio: 4999,
    descripcion: 'Diseño de sitio web profesional especializado para donatarias.'
  },
  INFORME_ANUAL: {
    id: 'informe_anual',
    nombre: 'Elaboración de Informe Anual CLUNI',
    precio: 2320,
    descripcion: 'Preparación y presentación del informe obligatorio anual.'
  },
  CAMBIO_REPRESENTANTE: {
    id: 'cambio_rep',
    nombre: 'Actualización de Representante Legal en CLUNI',
    precio: 2320,
    descripcion: 'Carga de actas con modificaciones de representación.'
  },
  REGULARIZACION: {
    id: 'regularizacion',
    nombre: 'Regularización Contable / Declaraciones',
    precio: 0,
    precioVariable: true,
    descripcion: 'Servicio variable según el atraso. Requiere cotización personalizada.'
  }
};

export const COMISION_FINANCIAMIENTO = 0.15; // 15% de recargo por pagos diferidos
