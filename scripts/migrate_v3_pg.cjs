const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
  return acc;
}, {});

// Intentar obtener la URL de la base de datos de .env.local
const connectionString = env.SUPABASE_DB_URL || env.DATABASE_URL;

if (!connectionString) {
  console.error('No se encontró SUPABASE_DB_URL o DATABASE_URL en .env.local');
  process.exit(1);
}

const client = new Client({
  connectionString: connectionString,
});

async function runMigration() {
  const sql = `
    -- Update PlanPagos enum
    DO $$ 
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_pagos') THEN
            CREATE TYPE plan_pagos AS ENUM ('unico', '2_meses', '4_meses', '3_msi', '6_msi', '12_msi', '18_msi', '2_pagos', '4_pagos');
        ELSE
            -- Intentar agregar valores si no existen
            BEGIN
                ALTER TYPE plan_pagos ADD VALUE '3_msi';
            EXCEPTION WHEN duplicate_object THEN NULL;
            END;
            BEGIN
                ALTER TYPE plan_pagos ADD VALUE '6_msi';
            EXCEPTION WHEN duplicate_object THEN NULL;
            END;
            BEGIN
                ALTER TYPE plan_pagos ADD VALUE '12_msi';
            EXCEPTION WHEN duplicate_object THEN NULL;
            END;
            BEGIN
                ALTER TYPE plan_pagos ADD VALUE '18_msi';
            EXCEPTION WHEN duplicate_object THEN NULL;
            END;
            BEGIN
                ALTER TYPE plan_pagos ADD VALUE '2_pagos';
            EXCEPTION WHEN duplicate_object THEN NULL;
            END;
            BEGIN
                ALTER TYPE plan_pagos ADD VALUE '4_pagos';
            EXCEPTION WHEN duplicate_object THEN NULL;
            END;
        END IF;
    END $$;

    -- Update TipoDocumento enum
    DO $$ 
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_documento') THEN
            CREATE TYPE tipo_documento AS ENUM ('ine_frente', 'ine_reverso', 'comprobante_domicilio', 'contrato_firmado', 'comprobante_pago', 'curp', 'csf', 'propuestas_nombre', 'autorizacion_nombre', 'acta_asamblea', 'proyecto_word', 'acuse_cita_sat', 'rfc_moral', 'otro');
        ELSE
            BEGIN
                ALTER TYPE tipo_documento ADD VALUE 'curp';
            EXCEPTION WHEN duplicate_object THEN NULL;
            END;
            BEGIN
                ALTER TYPE tipo_documento ADD VALUE 'csf';
            EXCEPTION WHEN duplicate_object THEN NULL;
            END;
            BEGIN
                ALTER TYPE tipo_documento ADD VALUE 'propuestas_nombre';
            EXCEPTION WHEN duplicate_object THEN NULL;
            END;
            BEGIN
                ALTER TYPE tipo_documento ADD VALUE 'autorizacion_nombre';
            EXCEPTION WHEN duplicate_object THEN NULL;
            END;
            BEGIN
                ALTER TYPE tipo_documento ADD VALUE 'acta_asamblea';
            EXCEPTION WHEN duplicate_object THEN NULL;
            END;
            BEGIN
                ALTER TYPE tipo_documento ADD VALUE 'proyecto_word';
            EXCEPTION WHEN duplicate_object THEN NULL;
            END;
            BEGIN
                ALTER TYPE tipo_documento ADD VALUE 'acuse_cita_sat';
            EXCEPTION WHEN duplicate_object THEN NULL;
            END;
            BEGIN
                ALTER TYPE tipo_documento ADD VALUE 'rfc_moral';
            EXCEPTION WHEN duplicate_object THEN NULL;
            END;
        END IF;
    END $$;

    -- Add columns to expedientes
    ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS numero_control TEXT;

    -- Add columns to contratos
    ALTER TABLE contratos ADD COLUMN IF NOT EXISTS observaciones_pago TEXT;
    ALTER TABLE contratos ADD COLUMN IF NOT EXISTS tipo_contrato TEXT DEFAULT 'legal';
  `;

  try {
    console.log('Conectando a la base de datos...');
    await client.connect();
    console.log('Ejecutando migración...');
    await client.query(sql);
    console.log('Migración completada con éxito.');
  } catch (err) {
    console.error('Error en migración:', err);
  } finally {
    await client.end();
  }
}

runMigration();
