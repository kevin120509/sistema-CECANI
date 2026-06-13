const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error, count } = await supabase
    .from('expedientes')
    .select('id, estatus, asesora_id', { count: 'exact' });

  if (error) {
    console.error(error);
    return;
  }

  console.log('Total Expedientes:', count);
  
  const stats = data.reduce((acc, exp) => {
    acc.estatus[exp.estatus] = (acc.estatus[exp.estatus] || 0) + 1;
    if (exp.asesora_id) acc.assigned++;
    else acc.unassigned++;
    return acc;
  }, { estatus: {}, assigned: 0, unassigned: 0 });

  console.log('Stats:', JSON.stringify(stats, null, 2));

  // Check a sample of unassigned or specific status
  console.log('Sample (first 5):', data.slice(0, 5));
}

check();
