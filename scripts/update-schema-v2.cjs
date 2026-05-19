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

async function updateSchema() {
  console.log('Iniciando actualización de esquema...');
  
  // Agregar comentario_rechazo a documentos
  const { error: errorDoc } = await supabase.rpc('execute_sql', {
    sql_query: 'ALTER TABLE documentos ADD COLUMN IF NOT EXISTS comentario_rechazo TEXT;'
  });
  
  if (errorDoc) {
    console.error('Error al agregar columna a documentos:', errorDoc);
  } else {
    console.log('Columna comentario_rechazo agregada a documentos (si no existía).');
  }

  // Agregar aprobado_directora a contratos
  const { error: errorCon } = await supabase.rpc('execute_sql', {
    sql_query: 'ALTER TABLE contratos ADD COLUMN IF NOT EXISTS aprobado_directora BOOLEAN DEFAULT FALSE;'
  });

  if (errorCon) {
    console.error('Error al agregar columna a contratos:', errorCon);
  } else {
    console.log('Columna aprobado_directora agregada a contratos (si no existía).');
  }
}

updateSchema();
