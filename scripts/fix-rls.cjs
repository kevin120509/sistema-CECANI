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

(async () => {
  // Check if RLS is enabled on catalogo_hitos
  console.log('Checking RLS status...');
  
  // Try to disable RLS first, then re-enable with proper policy
  // We'll use raw SQL via the admin client
  
  // Option 1: Just disable RLS on catalogo_hitos (it's a public catalog, everyone should read it)
  const { error: err1 } = await supabaseAdmin.rpc('exec_sql', {
    sql: `ALTER TABLE public.catalogo_hitos DISABLE ROW LEVEL SECURITY;`
  });
  
  if (err1) {
    console.log('Cannot use exec_sql RPC. Will try alternative approach...');
    console.log('Error:', err1.message);
    
    // Alternative: Use the REST API to check if the table has any policies
    // The issue is RLS is enabled but the policy might not cover the new integer-id rows
    // Let's try adding a broad SELECT policy
    
    console.log('\nSince we cannot modify RLS via script, we need to fix this in the Supabase Dashboard.');
    console.log('Go to: Supabase Dashboard > Authentication > Policies > catalogo_hitos');
    console.log('Either:');
    console.log('  1. Disable RLS on catalogo_hitos (recommended - it is a public catalog)');
    console.log('  2. Add a policy: SELECT for authenticated using (true)');
    
    // Alternative workaround: use the admin client in the server component
    console.log('\nORR... we can use the admin client (service_role) in the server component to bypass RLS.');
  } else {
    console.log('RLS disabled on catalogo_hitos successfully!');
  }
})();
