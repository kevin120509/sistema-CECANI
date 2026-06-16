require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: perfiles } = await supabase.from('perfiles').select('id, nombre_completo, rol');
  console.log("Total perfiles:", perfiles.length);
  const asesoras = perfiles.filter(p => p.rol === 'asesora' || p.rol === 'abogada');
  console.log("Asesoras:", asesoras.length);
  for (const a of asesoras) {
    console.log(a.nombre_completo, "-", a.rol);
  }
}

main();
