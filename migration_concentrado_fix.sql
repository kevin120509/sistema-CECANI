-- Migración: Columnas faltantes en datos_concentrado
-- Agrega columnas que el panel de abogada intenta guardar pero no existen en el esquema base.

ALTER TABLE datos_concentrado 
ADD COLUMN IF NOT EXISTS folio_rpp TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS libro_rpp TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS volumen_rpp TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS objeto_social_ventas TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS nombre_completo TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS rfc TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS curp TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS estado_civil TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS ocupacion TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS domicilio_completo TEXT DEFAULT '';

COMMENT ON COLUMN datos_concentrado.objeto_social_ventas IS 'Transcripción del objeto social acordado con el cliente.';
