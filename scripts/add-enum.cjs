const { Client } = require('pg');
const fs = require('fs');
const dotenv = require('dotenv');

async function addEnum() {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  const client = new Client({ connectionString: envConfig.DATABASE_URL });
  
  await client.connect();
  
  try {
    await client.query("ALTER TYPE estatus_expediente ADD VALUE IF NOT EXISTS 'esperando_firma_cliente';");
    console.log("Enum modificado correctamente.");
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('Value already exists, skipping.');
    } else {
      console.error("Error modificando enum:", error);
    }
  }
  
  await client.end();
}

addEnum();
