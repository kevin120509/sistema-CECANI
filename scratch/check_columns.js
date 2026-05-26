const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Query metadata of a document or insert/select to check if column exists
  const { data, error } = await supabase
    .from('documentos')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching documents:', error);
  } else {
    console.log('Columns found in documentos table:', Object.keys(data[0] || {}));
  }
}

main();
