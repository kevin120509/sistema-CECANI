-- ==========================================
-- MIGRACIÓN: Tabla solicitudes_alta
-- Para el flujo de alta de cliente por asesora
-- Ejecutar en Supabase SQL Editor
-- ==========================================

CREATE TABLE IF NOT EXISTS public.solicitudes_alta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asesora_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  nombre_cliente TEXT NOT NULL,
  telefono TEXT NOT NULL,
  nombre_empresa TEXT NOT NULL,
  rfc TEXT,
  notas TEXT,
  notas_rechazo TEXT,
  estatus TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | aprobada | rechazada
  expediente_id UUID REFERENCES public.expedientes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Verificación
SELECT id, nombre_cliente, nombre_empresa, estatus, created_at
FROM public.solicitudes_alta
ORDER BY created_at DESC
LIMIT 5;
