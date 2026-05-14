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
    precioLista: 75000,
    descripcion: 'Actualización de estatutos para asociaciones existentes.'
  },
  RECUPERACION_DONATARIA: {
    id: 'recuperacion',
    nombre: 'Recuperación de Donataria Autorizada',
    precioEspecial: 35000,
    precioLista: 40500,
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
  GASTOS_NOTARIALES: {
    id: 'notaria',
    nombre: 'Gastos Notariales (Protocolización e Inscripción)',
    precio: 16000,
    descripcion: 'Pago de honorarios de notaría y registro público.'
  },
  TRAMITE_CLUNI: {
    id: 'cluni',
    nombre: 'Trámite de CLUNI',
    precio: 10000,
    descripcion: 'Obtención de la Clave Única de Inscripción ante el Registro Federal.'
  },
  PAGINA_WEB: {
    id: 'web',
    nombre: 'Página Web Profesional',
    precio: 4999,
    esRegalo: true,
    descripcion: 'Diseño de sitio web profesional especializado para donatarias.'
  },
  ACTIVIDAD_EXTRA: {
    id: 'actividad_extra',
    nombre: 'Actividad Adicional (Constancia)',
    precio: 10000,
    descripcion: 'Costo por cada actividad adicional después de las primeras dos.'
  },
  INFORME_ANUAL: {
    id: 'informe_anual',
    nombre: 'Elaboración de Informe Anual CLUNI',
    precio: 2320,
    descripcion: 'Preparación y presentación del informe obligatorio anual.'
  },
  CAMBIO_REPRESENTANTE: {
    id: 'cambio_rep',
    nombre: 'Actualización de Representante Legal',
    precio: 2320,
    descripcion: 'Carga de actas con modificaciones de representación.'
  }
};

export const COMISION_FINANCIAMIENTO = 0.15; // 15% de recargo por pagos diferidos
