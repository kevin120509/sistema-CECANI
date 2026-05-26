const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
  return acc;
}, {});

const connectionString = env.SUPABASE_DB_URL || env.DATABASE_URL;

if (!connectionString) {
  console.error('No se encontró SUPABASE_DB_URL o DATABASE_URL en .env.local');
  process.exit(1);
}

const client = new Client({
  connectionString: connectionString,
});

async function runUpdate() {
  try {
    await client.connect();
    console.log('Conectado a la base de datos.');

    const valuesToAdd = ['3_msi', '6_msi', '12_msi', '18_msi', '2_pagos', '4_pagos'];
    
    for (const value of valuesToAdd) {
      try {
        // En PostgreSQL, ALTER TYPE ... ADD VALUE no puede ejecutarse dentro de un bloque de transacción en algunas versiones
        // por lo que lo ejecutamos uno por uno.
        await client.query(`ALTER TYPE plan_pagos ADD VALUE IF NOT EXISTS '${value}'`);
        console.log(`Valor '${value}' añadido (o ya existía).`);
      } catch (e) {
        if (e.message.includes('already exists')) {
          console.log(`El valor '${value}' ya existe.`);
        } else {
          console.error(`Error al añadir '${value}':`, e.message);
        }
      }
    }

    console.log('Proceso de actualización de ENUM finalizado.');
  } catch (err) {
    console.error('Error general:', err);
  } finally {
    await client.end();
  }
}

runUpdate();
