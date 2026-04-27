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
  // Check RLS policies on catalogo_hitos
  const { data: policies, error } = await supabaseAdmin.rpc('exec_sql', {
    sql: `SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
          FROM pg_policies 
          WHERE tablename = 'catalogo_hitos'`
  });
  
  if (error) {
    console.log('Cannot use exec_sql, trying direct query...');
    // Alternative: check if we can read with anon key
    const { createClient: createAnon } = require('@supabase/supabase-js');
    const anonKey = envContent.split('\n').find(l => l.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY='))?.split('=')[1]?.trim();
    const anonClient = createAnon(supabaseUrl, anonKey);
    
    // Try to sign in as abogada and read hitos
    const { data: authData, error: authErr } = await anonClient.auth.signInWithPassword({
      email: 'abogada@cecani.com',
      password: 'password123'
    });
    
    if (authErr) {
      console.error('Auth error:', authErr);
      return;
    }
    
    console.log('Signed in as:', authData.user.email);
    
    const { data: hitos, error: hitosErr } = await anonClient
      .from('catalogo_hitos')
      .select('*')
      .order('orden');
    
    console.log('Hitos count:', hitos?.length || 0);
    if (hitosErr) console.error('Hitos error:', hitosErr);
    if (hitos) {
      hitos.forEach(h => console.log(`  [${h.orden}] ${h.nombre}`));
    }
    
    // Also check with admin (bypasses RLS)
    const { data: adminHitos } = await supabaseAdmin
      .from('catalogo_hitos')
      .select('*')
      .order('orden');
    console.log('\nAdmin hitos count:', adminHitos?.length || 0);
  } else {
    console.log('Policies:', JSON.stringify(policies, null, 2));
  }
})();
