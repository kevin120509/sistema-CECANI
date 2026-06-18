const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  
  const { data: perfiles } = await supabase.from('perfiles').select('id');
  const perfilesSet = new Set(perfiles.map(p => p.id));

  let deleted = 0;
  for (const u of users) {
    if (!perfilesSet.has(u.id)) {
      console.log(`Deleting orphaned auth user: ${u.email} (ID: ${u.id})`);
      await supabase.auth.admin.deleteUser(u.id);
      deleted++;
    }
  }

  // Check if user meant literally ALL users:
  console.log(`Deleted ${deleted} orphaned auth users.`);
}

main().catch(console.error);
