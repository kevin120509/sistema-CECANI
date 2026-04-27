const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

let supabaseUrl = '';
let supabaseServiceKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) supabaseServiceKey = line.split('=')[1].trim();
});

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Test: try to update expediente with a datos_concentrado JSONB field
(async () => {
  // First check if the column exists
  const { data, error } = await supabaseAdmin
    .from('expedientes')
    .select('id')
    .limit(1);
  
  console.log('Test select:', data?.length, 'rows', error ? `Error: ${error.message}` : 'OK');

  // Try adding datos_concentrado column
  const testExpId = data?.[0]?.id;
  if (testExpId) {
    const { error: updateErr } = await supabaseAdmin
      .from('expedientes')
      .update({ datos_concentrado: { test: 'hello' } })
      .eq('id', testExpId);
    
    if (updateErr) {
      console.log('Column does not exist yet:', updateErr.message);
      console.log('\n=== NECESITAS EJECUTAR ESTE SQL EN SUPABASE DASHBOARD ===');
      console.log('Ve a: https://supabase.com/dashboard/project/cvbvzseaokobbyawkbzf/sql/new');
      console.log('\nSQL:');
      console.log(`
ALTER TABLE public.expedientes ADD COLUMN IF NOT EXISTS datos_concentrado jsonb DEFAULT '{}'::jsonb;
      `);
    } else {
      console.log('Column already exists! Reverting test...');
      await supabaseAdmin
        .from('expedientes')
        .update({ datos_concentrado: {} })
        .eq('id', testExpId);
      console.log('Ready to use!');
    }
  }
})();
