-- ==========================================
-- SISTEMA CECANI: ACTUALIZACIÓN DE BASE DE DATOS
-- 1. Soporte para múltiples asesoras
-- 2. Limpieza de duplicados
-- 3. Sincronización de perfiles
-- ==========================================

-- A. TABLA RELACIONAL PARA MÚLTIPLES ASESORAS
CREATE TABLE IF NOT EXISTS expediente_asesoras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID REFERENCES expedientes(id) ON DELETE CASCADE,
    asesora_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(expediente_id, asesora_id)
);

-- B. MIGRACIÓN DE ASESORA ACTUAL
-- Insertamos la relación actual si existe
INSERT INTO expediente_asesoras (expediente_id, asesora_id)
SELECT id, asesora_id 
FROM expedientes 
WHERE asesora_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- C. LIMPIEZA DE EXPEDIENTES DUPLICADOS
-- Buscamos duplicados por nombre de empresa (ignorando casos de prueba)
-- Mantendremos el registro más reciente
WITH duplicados AS (
    SELECT 
        id,
        nombre_empresa,
        ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(nombre_empresa)) 
            ORDER BY updated_at DESC, created_at DESC
        ) as rn
    FROM expedientes
    WHERE LOWER(nombre_empresa) NOT LIKE '%kevin vargas%'
      AND LOWER(nombre_empresa) NOT LIKE '%miguelito%'
      AND nombre_empresa IS NOT NULL
      AND TRIM(nombre_empresa) != ''
)
DELETE FROM expedientes
WHERE id IN (
    SELECT id FROM duplicados WHERE rn > 1
);

-- D. LIMPIEZA DE PERFILES COMBINADOS (Opcional: Esto ayuda a que el filtro sea individual)
-- Nota: Esta parte es delicada, es mejor manejarla por script de Node si se requiere crear usuarios nuevos con Auth.
-- Por ahora aseguramos que los nombres individuales existan como perfiles.

-- E. AUTO-ASIGNACIÓN DESDE DATOS CONCENTRADO
-- Si el nombre en 'vendedora' coincide exactamente con una asesora, la asignamos.
INSERT INTO expediente_asesoras (expediente_id, asesora_id)
SELECT dc.expediente_id, p.id
FROM datos_concentrado dc
JOIN perfiles p ON (
    LOWER(TRIM(dc.vendedora)) = LOWER(TRIM(p.nombre_completo))
)
WHERE p.rol IN ('asesora', 'abogada', 'admin')
ON CONFLICT DO NOTHING;

-- F. CASOS ESPECIALES DE AUTO-ASIGNACIÓN (Mapeo manual de nombres comunes)
-- Ejemplo: 'CLAU' -> 'CLAUDIA' (Si existe ese perfil)
INSERT INTO expediente_asesoras (expediente_id, asesora_id)
SELECT dc.expediente_id, p.id
FROM datos_concentrado dc
JOIN perfiles p ON (
    (LOWER(TRIM(dc.vendedora)) = 'clau' AND LOWER(TRIM(p.nombre_completo)) = 'claudia') OR
    (LOWER(TRIM(dc.vendedora)) = 'kathy' AND LOWER(TRIM(p.nombre_completo)) = 'kathyuska') OR
    (LOWER(TRIM(dc.vendedora)) = 'aracely' AND LOWER(TRIM(p.nombre_completo)) = 'araceli')
)
WHERE p.rol IN ('asesora', 'abogada', 'admin')
ON CONFLICT DO NOTHING;
