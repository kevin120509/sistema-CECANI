const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRLS() {
  console.log('--- Verificando Políticas RLS ---');
  // Consultar directamente la tabla de sistema para ver las políticas
  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: `
      SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE schemaname = 'public';
    `
  });

  if (error) {
    console.error('No se pudo usar RPC para leer pg_policies. Intentando otro método o asumiendo bloqueo RLS:', error.message);
  } else {
    console.log('Políticas Activas:', JSON.stringify(data, null, 2));
  }
}

checkRLS();
