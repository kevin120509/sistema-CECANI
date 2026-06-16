require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: expedientes, error } = await supabase
    .from('expedientes')
    .select(`
      id,
      nombre_empresa,
      asesora_id,
      datos_concentrado ( asesora_encargada )
    `);

  if (error) {
    console.error("Error:", error);
    return;
  }
  
  let multiples = 0;
  for (const exp of expedientes) {
    const rawAsesora = exp.datos_concentrado?.[0]?.asesora_encargada;
    if (rawAsesora && rawAsesora.includes('-')) {
      console.log(exp.nombre_empresa, "=>", rawAsesora);
      multiples++;
    }
  }
  console.log("Total multiple candidates:", multiples);
}

main();
