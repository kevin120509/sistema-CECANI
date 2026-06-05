-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.bitacora (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  expediente_id uuid NOT NULL,
  autor_id uuid NOT NULL,
  nota text NOT NULL,
  fecha_proximo_seguimiento date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT bitacora_pkey PRIMARY KEY (id),
  CONSTRAINT bitacora_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expedientes(id),
  CONSTRAINT bitacora_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.perfiles(id)
);
CREATE TABLE public.catalogo_figuras (
  id integer NOT NULL DEFAULT nextval('catalogo_figuras_id_seq'::regclass),
  siglas character varying NOT NULL,
  descripcion text NOT NULL,
  CONSTRAINT catalogo_figuras_pkey PRIMARY KEY (id)
);
CREATE TABLE public.catalogo_hitos (
  id integer NOT NULL DEFAULT nextval('catalogo_hitos_id_seq'::regclass),
  nombre character varying NOT NULL,
  orden integer NOT NULL,
  CONSTRAINT catalogo_hitos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.contratos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  expediente_id uuid NOT NULL,
  plan_pagos USER-DEFINED NOT NULL,
  monto_total numeric NOT NULL DEFAULT 0.00,
  url_pdf_generado text,
  url_pdf_firmado_cliente text,
  url_pdf_doble_firma text,
  estatus USER-DEFINED DEFAULT 'generado'::estatus_contrato,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  servicio_base text,
  modulos_extra jsonb,
  CONSTRAINT contratos_pkey PRIMARY KEY (id),
  CONSTRAINT contratos_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expedientes(id)
);
CREATE TABLE public.datos_concentrado (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  expediente_id uuid NOT NULL UNIQUE,
  asesora_encargada text DEFAULT ''::text,
  estado text DEFAULT ''::text,
  actividad text DEFAULT ''::text,
  cluni text DEFAULT ''::text,
  estatus_rpp text DEFAULT ''::text,
  notaria text DEFAULT ''::text,
  pago_notario text DEFAULT ''::text,
  total_contrato text DEFAULT ''::text,
  periodicidad_pagos text DEFAULT ''::text,
  pago_entrega_donataria text DEFAULT ''::text,
  cantidad_cobrar_proximo text DEFAULT ''::text,
  estatus_detalle text DEFAULT ''::text,
  accion_realizar text DEFAULT ''::text,
  num_pagos_realizados text DEFAULT ''::text,
  cantidad_pagada_acumulada text DEFAULT ''::text,
  saldo_cliente text DEFAULT ''::text,
  fecha_ultimo_pago text DEFAULT ''::text,
  quien_cobra text DEFAULT ''::text,
  vendedora text DEFAULT ''::text,
  telefono_cliente text DEFAULT ''::text,
  fecha_contrato text DEFAULT ''::text,
  link_reunion text DEFAULT ''::text,
  fecha_reunion_acuerdos text DEFAULT ''::text,
  folio_rpp text DEFAULT ''::text,
  libro_rpp text DEFAULT ''::text,
  volumen_rpp text DEFAULT ''::text,
  objeto_social_ventas text DEFAULT ''::text,
  nombre_completo text DEFAULT ''::text,
  rfc text DEFAULT ''::text,
  curp text DEFAULT ''::text,
  estado_civil text DEFAULT ''::text,
  ocupacion text DEFAULT ''::text,
  domicilio_completo text DEFAULT ''::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT datos_concentrado_pkey PRIMARY KEY (id),
  CONSTRAINT datos_concentrado_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expedientes(id)
);
CREATE TABLE public.documentos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  expediente_id uuid NOT NULL,
  tipo USER-DEFINED NOT NULL,
  url_archivo text NOT NULL,
  validado boolean DEFAULT false,
  solicitud_borrado boolean DEFAULT false,
  motivo_borrado text,
  motivo_rechazo text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT documentos_pkey PRIMARY KEY (id),
  CONSTRAINT documentos_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expedientes(id)
);
CREATE TABLE public.expedientes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  cliente_id uuid NOT NULL,
  asesora_id uuid,
  figura_id integer NOT NULL,
  nombre_empresa character varying NOT NULL,
  estatus USER-DEFINED DEFAULT 'en_registro'::estatus_expediente,
  motivo_rechazo text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tipo_tramite text,
  servicios_extra jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT expedientes_pkey PRIMARY KEY (id),
  CONSTRAINT expedientes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.perfiles(id),
  CONSTRAINT expedientes_asesora_id_fkey FOREIGN KEY (asesora_id) REFERENCES public.perfiles(id),
  CONSTRAINT expedientes_figura_id_fkey FOREIGN KEY (figura_id) REFERENCES public.catalogo_figuras(id)
);
CREATE TABLE public.pagos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  expediente_id uuid NOT NULL,
  monto numeric NOT NULL,
  fecha_pago date NOT NULL,
  url_comprobante text NOT NULL,
  es_pago_inicial boolean DEFAULT false,
  verificado boolean DEFAULT false,
  motivo_rechazo text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pagos_pkey PRIMARY KEY (id),
  CONSTRAINT pagos_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expedientes(id)
);
CREATE TABLE public.perfiles (
  id uuid NOT NULL,
  rol USER-DEFINED NOT NULL DEFAULT 'cliente'::rol_usuario,
  nombre_completo character varying NOT NULL,
  telefono character varying,
  estado character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  rfc text,
  curp text,
  ocupacion text,
  estado_civil text,
  domicilio_completo text,
  folio_ine text,
  CONSTRAINT perfiles_pkey PRIMARY KEY (id),
  CONSTRAINT perfiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.seguimiento_tareas (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  expediente_id uuid NOT NULL,
  hito_id integer NOT NULL,
  estatus USER-DEFINED DEFAULT 'pendiente'::estatus_tarea,
  fecha_completado timestamp with time zone,
  CONSTRAINT seguimiento_tareas_pkey PRIMARY KEY (id),
  CONSTRAINT seguimiento_tareas_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expedientes(id),
  CONSTRAINT seguimiento_tareas_hito_id_fkey FOREIGN KEY (hito_id) REFERENCES public.catalogo_hitos(id)
);