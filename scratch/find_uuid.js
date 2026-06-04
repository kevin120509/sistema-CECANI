const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function findUUID() {
  const targetId = '2610ef9b-651b-4198-b1c6-90965977111b';
  
  console.log(`Buscando UUID: ${targetId}`);

  const { data: p } = await supabase.from('perfiles').select('id, nombre_completo').eq('id', targetId).maybeSingle();
  if (p) console.log('ENCONTRADO en perfiles:', p);
  else console.log('No encontrado en perfiles');

  const { data: e } = await supabase.from('expedientes').select('id, nombre_empresa').eq('id', targetId).maybeSingle();
  if (e) console.log('ENCONTRADO en expedientes:', e);
  else console.log('No encontrado en expedientes');

  const { data: e2 } = await supabase.from('expedientes').select('id, nombre_empresa').eq('cliente_id', targetId).maybeSingle();
  if (e2) console.log('ENCONTRADO en expedientes (como cliente_id):', e2);
  else console.log('No encontrado como cliente_id en expedientes');
}

findUUID();
