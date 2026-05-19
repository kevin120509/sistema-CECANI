const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
  const sql = `
    -- Update PlanPagos enum
    DO $$ 
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_pagos') THEN
            CREATE TYPE plan_pagos AS ENUM ('unico', '2_meses', '4_meses', '3_msi', '6_msi', '12_msi', '18_msi', '2_pagos', '4_pagos');
        ELSE
            ALTER TYPE plan_pagos ADD VALUE IF NOT EXISTS '3_msi';
            ALTER TYPE plan_pagos ADD VALUE IF NOT EXISTS '6_msi';
            ALTER TYPE plan_pagos ADD VALUE IF NOT EXISTS '12_msi';
            ALTER TYPE plan_pagos ADD VALUE IF NOT EXISTS '18_msi';
            ALTER TYPE plan_pagos ADD VALUE IF NOT EXISTS '2_pagos';
            ALTER TYPE plan_pagos ADD VALUE IF NOT EXISTS '4_pagos';
        END IF;
    END $$;

    -- Update TipoDocumento enum
    DO $$ 
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_documento') THEN
            CREATE TYPE tipo_documento AS ENUM ('ine_frente', 'ine_reverso', 'comprobante_domicilio', 'contrato_firmado', 'comprobante_pago', 'curp', 'csf', 'propuestas_nombre', 'autorizacion_nombre', 'acta_asamblea', 'proyecto_word', 'acuse_cita_sat', 'rfc_moral', 'otro');
        ELSE
            ALTER TYPE tipo_documento ADD VALUE IF NOT EXISTS 'curp';
            ALTER TYPE tipo_documento ADD VALUE IF NOT EXISTS 'csf';
            ALTER TYPE tipo_documento ADD VALUE IF NOT EXISTS 'propuestas_nombre';
            ALTER TYPE tipo_documento ADD VALUE IF NOT EXISTS 'autorizacion_nombre';
            ALTER TYPE tipo_documento ADD VALUE IF NOT EXISTS 'acta_asamblea';
            ALTER TYPE tipo_documento ADD VALUE IF NOT EXISTS 'proyecto_word';
            ALTER TYPE tipo_documento ADD VALUE IF NOT EXISTS 'acuse_cita_sat';
            ALTER TYPE tipo_documento ADD VALUE IF NOT EXISTS 'rfc_moral';
        END IF;
    END $$;

    -- Add columns to expedientes
    ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS numero_control TEXT;

    -- Add columns to contratos
    ALTER TABLE contratos ADD COLUMN IF NOT EXISTS observaciones_pago TEXT;
    ALTER TABLE contratos ADD COLUMN IF NOT EXISTS tipo_contrato TEXT DEFAULT 'legal';
  `;

  console.log('Ejecutando migración...');
  const { error } = await supabase.rpc('execute_sql', { sql_query: sql });

  if (error) {
    console.error('Error en migración:', error);
  } else {
    console.log('Migración completada con éxito.');
  }
}

runMigration();
