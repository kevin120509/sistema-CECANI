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
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'sa-east-1'
];

async function testRegion(region) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const dbUrl = `postgres://postgres.cvbvzseaokobbyawkbzf:Antigravity2026!@${host}:6543/postgres`;
  
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log(`SUCCESS: Connected to ${region}`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`Failed for ${region}:`, err.message);
    return false;
  }
}

async function main() {
  for (const region of regions) {
    const success = await testRegion(region);
    if (success) {
      console.log(`Found correct region: ${region}`);
      break;
    }
  }
}

main();
