const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

let supabaseUrl = '';
let supabaseServiceKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) supabaseServiceKey = line.split('=')[1].trim();
});

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

(async () => {
  // 1. Check catalogo_hitos
  const { data: hitos, error: e1 } = await supabaseAdmin.from('catalogo_hitos').select('*').order('orden');
  console.log('=== CATALOGO_HITOS ===');
  console.log(JSON.stringify(hitos, null, 2));
  if (e1) console.error('Error hitos:', e1);

  // 2. Check seguimiento_tareas
  const { data: tareas, error: e2 } = await supabaseAdmin.from('seguimiento_tareas').select('*');
  console.log('\n=== SEGUIMIENTO_TAREAS ===');
  console.log(JSON.stringify(tareas, null, 2));
  if (e2) console.error('Error tareas:', e2);

  // 3. Check expedientes with pagos and contratos
  const { data: exps, error: e3 } = await supabaseAdmin.from('expedientes').select(`
    id, nombre_empresa, asesora_id,
    contratos(*),
    pagos(*)
  `);
  console.log('\n=== EXPEDIENTES con contratos y pagos ===');
  console.log(JSON.stringify(exps, null, 2));
  if (e3) console.error('Error expedientes:', e3);
})();
