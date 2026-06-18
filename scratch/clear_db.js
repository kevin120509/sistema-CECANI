const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const R2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET_NAME = process.env.R2_BUCKET_NAME;

async function clearBucket() {
  console.log('Clearing R2 bucket...');
  let isTruncated = true;
  let cursor;
  let deletedCount = 0;

  while (isTruncated) {
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      ContinuationToken: cursor,
    });
    const listResponse = await R2.send(listCommand);

    if (listResponse.Contents && listResponse.Contents.length > 0) {
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: {
          Objects: listResponse.Contents.map((c) => ({ Key: c.Key })),
        },
      });
      await R2.send(deleteCommand);
      deletedCount += listResponse.Contents.length;
    }

    isTruncated = listResponse.IsTruncated;
    cursor = listResponse.NextContinuationToken;
  }
  console.log(`Deleted ${deletedCount} files from R2.`);
}

async function main() {
  console.log('Iniciando limpieza de la base de datos...');
  
  // 1. Fetch all clientes and their expedientes
  console.log('Fetching expedientes...');
  const { data: expedientes, error: expError } = await supabase
    .from('expedientes')
    .select('id, cliente_id');
  if (expError) throw expError;

  console.log(`Found ${expedientes.length} expedientes.`);

  // We do not need to delete tables row by row if we just TRUNCATE or delete everything except catalogs.
  // Wait, if we use Supabase REST API, we can just delete where id is not null.
  
  console.log('Deleting dependent tables...');
  const tables = [
    'bitacora',
    'contratos',
    'datos_concentrado',
    'documentos',
    'pagos',
    'seguimiento_tareas',
    'expediente_asesoras',
    'integrantes_firma',
    'notificaciones',
    'recordatorios'
  ];

  for (const table of tables) {
    console.log(`Deleting ${table}...`);
    // Delete all records in chunks of 1000? Or just delete with neq.
    let count = -1;
    while (count !== 0) {
      const { data, error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id');
      if (error) console.error(`Error deleting ${table}:`, error.message);
      count = data ? data.length : 0;
      console.log(`Deleted ${count} from ${table}`);
      if (count < 1000) break; // Supabase limit is 1000 usually
    }
  }

  console.log('Deleting expedientes...');
  let countExp = -1;
  while (countExp !== 0) {
    const { data, error } = await supabase.from('expedientes').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id');
    if (error) console.error('Error deleting expedientes:', error.message);
    countExp = data ? data.length : 0;
  }

  console.log('Fetching clientes perfiles...');
  const { data: clientes, error: cliError } = await supabase
    .from('perfiles')
    .select('id')
    .eq('rol', 'cliente');
    
  if (cliError) throw cliError;

  console.log(`Deleting ${clientes.length} cliente perfiles and auth users...`);
  // Delete perfiles
  let countPerf = -1;
  while (countPerf !== 0) {
    const { data, error } = await supabase.from('perfiles').delete().eq('rol', 'cliente').select('id');
    if (error) console.error('Error deleting perfiles:', error.message);
    countPerf = data ? data.length : 0;
  }

  // Delete Auth Users for clients
  let authDeleted = 0;
  for (const c of clientes) {
    const { error } = await supabase.auth.admin.deleteUser(c.id);
    if (!error) authDeleted++;
  }
  console.log(`Deleted ${authDeleted} auth users.`);

  // 2. Delete R2 bucket contents
  await clearBucket();

  console.log('Limpieza completada con éxito.');
}

main().catch(console.error);
