-- ==========================================
-- MIGRACIÓN: Expandir solicitudes_alta
-- Para soportar flujo tipo Alta Maestra
-- ==========================================

ALTER TABLE public.solicitudes_alta 
ADD COLUMN IF NOT EXISTS curp TEXT,
ADD COLUMN IF NOT EXISTS ocupacion TEXT,
ADD COLUMN IF NOT EXISTS estado_civil TEXT,
ADD COLUMN IF NOT EXISTS domicilio_completo TEXT,
ADD COLUMN IF NOT EXISTS url_ine_frente TEXT,
ADD COLUMN IF NOT EXISTS url_ine_reverso TEXT,
ADD COLUMN IF NOT EXISTS url_curp TEXT,
ADD COLUMN IF NOT EXISTS url_comprobante_domicilio TEXT,
ADD COLUMN IF NOT EXISTS url_contrato TEXT,
ADD COLUMN IF NOT EXISTS monto_total NUMERIC,
ADD COLUMN IF NOT EXISTS plan_pagos TEXT;
