import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkExpedientes() {
  const { data: expedientes, error } = await supabase
    .from('expedientes')
    .select('id, cliente_id, estatus, documentos(id, tipo, validado)')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching:', error);
    return;
  }
  
  console.log('Last 5 Expedientes:');
  console.log(JSON.stringify(expedientes, null, 2));
}

checkExpedientes();
