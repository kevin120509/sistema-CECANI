const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data, error } = await supabase.from('perfiles').select('id, nombre_completo, rol');
  if (error) throw error;
  console.log('Perfiles:', data);
  
  const { data: users, error: err2 } = await supabase.auth.admin.listUsers();
  console.log('Auth users:', users.users.map(u => ({ email: u.email, id: u.id })));
}

main().catch(console.error);
