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
  const toDelete = allUsers.filter(u => !allowedUserIds.has(u.id));
  
  // Process in chunks of 50
  const chunkSize = 50;
  for (let i = 0; i < toDelete.length; i += chunkSize) {
    const chunk = toDelete.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (u) => {
      try {
        const { error } = await supabase.auth.admin.deleteUser(u.id);
        if (error) {
           if (!error.message.includes("User not found")) {
              console.error(`Error deleting ${u.email}:`, error.message);
           }
        } else {
           deletedAuthUsers++;
        }
      } catch (err) {
        if (!err.message.includes("User not found")) {
          console.error(`Fetch error deleting ${u.email}:`, err.message);
        }
      }
    }));
    console.log(`Processed ${Math.min(i + chunkSize, toDelete.length)} / ${toDelete.length} auth users...`);
  }

  console.log(`Cleanup finished:`);
  console.log(`Deleted ${deletedPerfiles} perfiles.`);
  console.log(`Deleted ${deletedAuthUsers} auth users.`);
}

main().catch(console.error);
