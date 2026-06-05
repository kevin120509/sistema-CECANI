const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase.from('datos_concentrado').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Columns in datos_concentrado:', Object.keys(data[0] || {}));
  }
}
main();
