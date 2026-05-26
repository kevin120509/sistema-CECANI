const { Client } = require('pg');

const regions = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ca-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'eu-north-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-south-1',
  'sa-east-1'
];

async function run() {
  const password = "Antigravity2026!";
  const projectRef = "cvbvzseaokobbyawkbzf";
  
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const connectionString = `postgres://postgres.${projectRef}:${password}@${host}:6543/postgres?sslmode=disable`;
    
    console.log(`Trying ${region} (${host})...`);
    const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
    try {
      await client.connect();
      console.log(`\n🎉 SUCCESS! Connected to region: ${region}`);
      const res = await client.query('SELECT version();');
      console.log('Result:', res.rows[0]);
      await client.end();
      break;
    } catch (err) {
      console.log(`❌ Failed ${region}: ${err.message}`);
      try { await client.end(); } catch(e) {}
    }
  }
}

run();
