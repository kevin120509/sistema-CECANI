require('dotenv').config({ path: require('path').resolve(__dirname, '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: expedienteData, error } = await supabase
    .from('expedientes')
    .select('id, cliente_id, estatus, contratos(id, url_pdf_generado, modulos_extra, monto_total)')
    .eq('estatus', 'en_proceso')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !expedienteData) {
    console.error('Error fetching data:', error);
    return;
  }

  console.log('Expediente:', JSON.stringify(expedienteData, null, 2));
}

main();
