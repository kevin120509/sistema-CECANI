const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function updateDocumentSchema() {
  console.log('--- Actualizando tabla "documentos" para soportar motivos de rechazo específicos ---');
  
  // Agregamos la columna motivo_rechazo a la tabla documentos
  const { error } = await supabase.rpc('execute_sql', {
    sql_query: 'ALTER TABLE documentos ADD COLUMN IF NOT EXISTS motivo_rechazo text;'
  });

  if (error) {
    console.error('Error al ejecutar SQL via RPC:', error.message);
    console.log('RECOMENDACIÓN: Ejecuta "ALTER TABLE documentos ADD COLUMN IF NOT EXISTS motivo_rechazo text;" manualmente en el SQL Editor de Supabase.');
  } else {
    console.log('✅ Columna "motivo_rechazo" agregada a la tabla "documentos".');
  }
}

updateDocumentSchema();
