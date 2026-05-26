const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('documentos')
    .select('tipo')
    .limit(100);

  if (error) {
    console.error('Error:', error);
  } else {
    const types = new Set(data.map(d => d.tipo));
    console.log('Distinct document types in DB:', Array.from(types));
  }
}

main();
