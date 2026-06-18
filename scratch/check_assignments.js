const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: rels } = await supabase.from('expediente_asesoras').select('*');
  console.log("Total assignments in expediente_asesoras:", rels ? rels.length : 0);
  
  const { data: exps } = await supabase.from('expedientes').select('id, asesora_id').not('asesora_id', 'is', null);
  console.log("Total expedientes with asesora_id:", exps ? exps.length : 0);
}
check();
