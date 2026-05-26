-- ================================================================
-- TABLA: recordatorios
-- Eventos programados con notificación a abogada (OneSignal push)
-- y mensaje pre-generado para cliente vía WhatsApp.
-- ================================================================

CREATE TYPE tipo_recordatorio AS ENUM (
  'meet_cliente',
  'entrega_docs',
  'cita_notaria',
  'seguimiento',
  'pago',
  'otro'
);

CREATE TYPE estatus_recordatorio AS ENUM (
  'pendiente',
  'enviado',
  'completado',
  'cancelado'
);

CREATE TABLE public.recordatorios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  expediente_id uuid NOT NULL,
  creado_por uuid NOT NULL,
  tipo tipo_recordatorio NOT NULL DEFAULT 'meet_cliente',
  titulo text NOT NULL,
  descripcion text,
  fecha date NOT NULL,
  hora time without time zone,
  link_reunion text,
  docs_requeridos jsonb DEFAULT '[]'::jsonb,
  notificar_abogada boolean NOT NULL DEFAULT true,
  notificar_cliente_whatsapp boolean NOT NULL DEFAULT true,
  whatsapp_enviado boolean NOT NULL DEFAULT false,
  push_enviado boolean NOT NULL DEFAULT false,
  estatus estatus_recordatorio NOT NULL DEFAULT 'pendiente',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),

  CONSTRAINT recordatorios_pkey PRIMARY KEY (id),
  CONSTRAINT recordatorios_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expedientes(id) ON DELETE CASCADE,
  CONSTRAINT recordatorios_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.perfiles(id)
);

-- Índices para consultas frecuentes
CREATE INDEX idx_recordatorios_expediente ON public.recordatorios(expediente_id);
CREATE INDEX idx_recordatorios_fecha ON public.recordatorios(fecha);
CREATE INDEX idx_recordatorios_estatus ON public.recordatorios(estatus);
CREATE INDEX idx_recordatorios_creado_por ON public.recordatorios(creado_por);

-- RLS: Las asesoras solo ven los recordatorios de sus expedientes
ALTER TABLE public.recordatorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Asesoras ven recordatorios de sus expedientes"
  ON public.recordatorios FOR SELECT
  USING (
    expediente_id IN (
      SELECT id FROM public.expedientes
      WHERE asesora_id = auth.uid()
    )
    OR creado_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid() AND rol IN ('directora', 'admin')
    )
  );

CREATE POLICY "Asesoras crean recordatorios en sus expedientes"
  ON public.recordatorios FOR INSERT
  WITH CHECK (
    expediente_id IN (
      SELECT id FROM public.expedientes
      WHERE asesora_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid() AND rol IN ('directora', 'admin')
    )
  );

CREATE POLICY "Asesoras actualizan sus recordatorios"
  ON public.recordatorios FOR UPDATE
  USING (
    creado_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid() AND rol IN ('directora', 'admin')
    )
  );

-- Trigger: actualiza updated_at automáticamente
CREATE OR REPLACE FUNCTION update_recordatorio_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recordatorios_updated_at
  BEFORE UPDATE ON public.recordatorios
  FOR EACH ROW EXECUTE FUNCTION update_recordatorio_updated_at();
