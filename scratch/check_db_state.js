const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkDB() {
  console.log('--- TODOS LOS EXPEDIENTES ---');
  const { data: exps } = await supabase.from('expedientes').select('*');
  console.log('Total Exps:', exps ? exps.length : 0);

  console.log('\n--- TODOS LOS CONTRATOS ---');
  const { data: cons } = await supabase.from('contratos').select('*');
  console.log('Total Contratos:', cons ? cons.length : 0);

  console.log('\n--- TODOS LOS DOCUMENTOS ---');
  const { data: docs } = await supabase.from('documentos').select('*');
  console.log('Total Docs:', docs ? docs.length : 0);
}

checkDB();
