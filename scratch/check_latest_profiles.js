const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('perfiles').select('id, rol, nombre_completo, created_at').order('created_at', { ascending: false }).limit(50);
  console.log("Most recent 50 profiles:");
  data.forEach(p => console.log(`${p.created_at} | Role: ${p.rol} | Name: ${p.nombre_completo}`));
}
check();
