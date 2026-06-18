const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  let allUsers = [];
  let page = 1;
  while (true) {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return console.error(error);
    if (users.length === 0) break;
    allUsers.push(...users);
    page++;
  }
  
  const personalUsers = allUsers.filter(u => 
    !u.email.endsWith('@cecani.temp') && 
    !u.email.endsWith('@cecani.com')
  );
  
  console.log(`Total Auth Users: ${allUsers.length}`);
  console.log(`Personal/Other Email Users: ${personalUsers.length}`);
  personalUsers.forEach(u => {
    console.log(`${u.created_at} | ID: ${u.id} | Email: ${u.email} | Meta: ${JSON.stringify(u.user_metadata)}`);
  });
}
check();
