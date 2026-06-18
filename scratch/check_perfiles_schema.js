const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('perfiles').select('*').eq('rol', 'abogada');
  if (data && data.length > 0) {
    console.log(Object.keys(data[0]));
    console.log("Total abogadas:", data.length);
    console.log(data.map(p => ({ id: p.id, nombre: p.nombre_completo, email: p.email, correo: p.correo })));
  }
}
check();
