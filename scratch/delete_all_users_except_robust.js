const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const allowedEmails = ['kevin.36137@gmail.com', 'abogada.cecani@gmail.com'];
  let deletedAuthUsers = 0;

  console.log('Fetching all auth users...');
  let allUsers = [];
  let page = 1;
  while (true) {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error('Error fetching users:', error);
      break;
    }
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

  console.log(`Found ${allUsers.length} total users.`);

  // Delete all perfiles except those belonging to the allowed user IDs
  console.log('Deleting perfiles...');
  const { data: allPerfiles } = await supabase.from('perfiles').select('id, nombre_completo');
  let deletedPerfiles = 0;
  for (const p of allPerfiles || []) {
    if (!allowedUserIds.has(p.id)) {
      await supabase.from('perfiles').delete().eq('id', p.id);
      deletedPerfiles++;
    }
  }
  console.log(`Deleted ${deletedPerfiles} perfiles.`);

  console.log('Deleting auth users...');
  let i = 0;
  for (const u of allUsers) {
    if (!allowedUserIds.has(u.id)) {
      let retries = 3;
      while (retries > 0) {
        try {
          const { error } = await supabase.auth.admin.deleteUser(u.id);
          if (error) throw error;
          deletedAuthUsers++;
          break;
        } catch (err) {
          retries--;
          if (retries === 0) {
            console.error(`Failed to delete user ${u.email} after 3 retries:`, err.message || err);
          } else {
            await sleep(1000); // backoff
          }
        }
      }
      i++;
      if (i % 50 === 0) console.log(`Processed ${i} auth users...`);
    }
  }

  console.log(`Cleanup finished:`);
  console.log(`Deleted ${deletedPerfiles} perfiles.`);
  console.log(`Deleted ${deletedAuthUsers} auth users.`);
}

main().catch(console.error);
