-- ==========================================
-- MIGRACIÓN CECANI - Solo lo necesario
-- Ejecutar en Supabase SQL Editor
-- ==========================================

-- 1. motivo_rechazo en documentos (ya ejecutado)
ALTER TABLE public.documentos 
  ADD COLUMN IF NOT EXISTS motivo_rechazo text;

-- 2. motivo_rechazo en pagos
ALTER TABLE public.pagos 
  ADD COLUMN IF NOT EXISTS motivo_rechazo text;

-- 3. motivo_rechazo en expedientes
ALTER TABLE public.expedientes 
  ADD COLUMN IF NOT EXISTS motivo_rechazo text;

-- Verificación
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE column_name = 'motivo_rechazo'
ORDER BY table_name;
