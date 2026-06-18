const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.log("No service role key found.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error(error);
    return;
  }
  console.log(`Total Auth Users: ${users.length}`);
  const recent = users.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 30);
  recent.forEach(u => {
    console.log(`${u.created_at} | ID: ${u.id} | Email: ${u.email} | Meta: ${JSON.stringify(u.user_metadata)}`);
  });
}
check();
