const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;
  
  console.log(`There are ${users.length} users left in auth.users.`);
  for (const u of users) {
    console.log(`- ${u.email} (ID: ${u.id})`);
  }
}

main().catch(console.error);
