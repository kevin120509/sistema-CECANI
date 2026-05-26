const { Client } = require('pg');

const dbUrl = "postgres://postgres.cvbvzseaokobbyawkbzf:Antigravity2026%21@aws-0-us-west-1.pooler.supabase.com:6543/postgres";

console.log('Connecting with URL-encoded password...');

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  try {
    const res = await client.query('SELECT NOW()');
    console.log('Success! Current time from DB:', res.rows[0]);
  } catch (err) {
    console.error('Failed to connect:', err);
  } finally {
    await client.end();
  }
}

main();
