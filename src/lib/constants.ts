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
    precioEspecial: 65000, // Contado / 3 MSI / 6 MSI
    precioLista: 75900,    // Valor oficial en contrato Mayo 2026
    descripcion: 'Creación de asociación civil desde cero con registro ante el SAT.'
  },
  ACTA_EXTRAORDINARIA: {
    id: 'acta_extra',
    nombre: 'Acta Extraordinaria + Donataria',
    precioEspecial: 65000, 
    precioLista: 75900,
    descripcion: 'Actualización de estatutos para asociaciones existentes.'
  },
  RECUPERACION_DONATARIA: {
    id: 'recuperacion',
    nombre: 'Recuperación / Renovación de Donataria',
    precioEspecial: 35000,
    precioLista: 35000,
    descripcion: 'Trámite para recuperar o renovar el estatus de donataria.'
  },
  CONTABILIDAD: {
    id: 'contabilidad',
    nombre: 'Servicios de Contabilidad / Donataria',
    precioEspecial: 15000, 
    precioLista: 18000,
    descripcion: 'Gestión contable especializada para donatarias autorizadas.'
  }
};

/**
 * Mapeo exacto de precios por plan de pagos para servicios de CONSTITUCION/ACTA.
 * Basado en las cotizaciones oficiales de 2026.
 */
export const PRECIOS_POR_PLAN: Record<string, number> = {
  unico: 65000,
  '3_msi': 65000,
  '6_msi': 65000,
  '12_msi': 76000,
  '18_msi': 78000,
  '2_pagos': 71000, // 2 x 35,500
  '4_pagos': 82500, // 4 x 20,625
};

export const PLANES_PAGO_LABELS: Record<string, string> = {
  unico: 'Pago Único de Contado',
  '3_msi': '3 Meses sin Intereses',
  '6_msi': '6 Meses sin Intereses',
  '12_msi': '12 Meses sin Intereses',
  '18_msi': '18 Meses sin Intereses',
  '2_pagos': '2 Pagos Quincenales',
  '4_pagos': '4 Pagos Quincenales',
};

export const SERVICIOS_EXTRAS: Record<string, ServicioExtra> = {
  TRAMITE_CLUNI: {
    id: 'cluni',
    nombre: 'Trámite de CLUNI desde cero',
    precio: 10000, // Precio especial al contratar paquete principal
    descripcion: 'Obtención de la Clave Única de Inscripción ante el Registro Federal.'
  },
  PAGINA_WEB: {
    id: 'web',
    nombre: 'Página Web Profesional',
    precio: 5000, // Precio base en paquete
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
