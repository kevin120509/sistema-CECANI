const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan variables de entorno");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAbogadas() {
  const { data, error } = await supabase
    .from('perfiles')
    .select('*')
    .eq('rol', 'abogada')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error obteniendo abogadas:", error);
    return;
  }

  console.log(`Hay ${data.length} abogadas registradas:`);
  data.forEach(p => {
    console.log(`- Nombre: ${p.nombre_completo} | Correo: ${p.correo} | ID: ${p.id} | Creado: ${p.created_at}`);
  });
}

checkAbogadas();
