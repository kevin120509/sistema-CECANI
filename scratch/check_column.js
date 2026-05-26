const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('documentos').select('integrante_id').limit(1);
  if (error) {
    console.error('Error selecting integrante_id:', error.message);
  } else {
    console.log('Success! Column exists, data:', data);
  }
}

run();
