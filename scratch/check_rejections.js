const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkDocs() {
  const { data, error } = await supabase
    .from('documentos')
    .select('id, tipo, validado, motivo_rechazo, url_archivo, expediente_id')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching docs:', error.message);
  } else {
    console.log('Ultimos 5 documentos:', JSON.stringify(data, null, 2));
  }

  const { data: exp } = await supabase
    .from('expedientes')
    .select('id, estatus, motivo_rechazo')
    .order('updated_at', { ascending: false })
    .limit(5);
  
  console.log('Ultimos 5 expedientes:', JSON.stringify(exp, null, 2));
}

checkDocs();
