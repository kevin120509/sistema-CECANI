-- Migración: Autorización de borrado de documentos
-- Este script agrega las columnas necesarias para que las abogadas soliciten
-- la eliminación de un documento y la directora deba autorizarlo.

ALTER TABLE documentos 
ADD COLUMN IF NOT EXISTS solicitud_borrado BOOLEAN DEFAULT FALSE, 
ADD COLUMN IF NOT EXISTS motivo_borrado TEXT;

COMMENT ON COLUMN documentos.solicitud_borrado IS 'Indica si una abogada ha solicitado eliminar este documento por error.';
COMMENT ON COLUMN documentos.motivo_borrado IS 'Razón proporcionada por la abogada para solicitar la baja del archivo.';
