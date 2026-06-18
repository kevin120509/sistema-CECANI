const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const allowedEmails = ['kevin.36137@gmail.com', 'abogada.cecani@gmail.com'];
  let deletedAuthUsers = 0;
  let deletedPerfiles = 0;

  // 1. Delete Perfiles that do not belong to the allowed emails
  // Since we don't know exactly which IDs map to the allowed emails unless we look them up:
  const { data: allowedUsers } = await supabase.auth.admin.listUsers(); // we'll fetch all auth users and map
  
  let allUsers = [];
  let page = 1;
  while (true) {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    if (users.length === 0) break;
    allUsers.push(...users);
    page++;
  }

  const allowedUserIds = new Set();
  for (const u of allUsers) {
    if (allowedEmails.includes(u.email)) {
      allowedUserIds.add(u.id);
      console.log(`Preserving: ${u.email} (ID: ${u.id})`);
    }
  }

  // Delete all perfiles except those belonging to the allowed user IDs
  const { data: allPerfiles } = await supabase.from('perfiles').select('id, nombre_completo');
  for (const p of allPerfiles || []) {
    if (!allowedUserIds.has(p.id)) {
      await supabase.from('perfiles').delete().eq('id', p.id);
      deletedPerfiles++;
    }
  }

  // Delete all auth users except the allowed ones
  for (const u of allUsers) {
    if (!allowedUserIds.has(u.id)) {
      const { error } = await supabase.auth.admin.deleteUser(u.id);
      if (!error) deletedAuthUsers++;
    }
  }

  console.log(`Cleanup finished:`);
  console.log(`Deleted ${deletedPerfiles} perfiles.`);
  console.log(`Deleted ${deletedAuthUsers} auth users.`);
}

main().catch(console.error);
