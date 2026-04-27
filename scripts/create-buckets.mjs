import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase variables in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log("Creando buckets 'documentos_cliente' y 'contratos'...");

  const buckets = ['documentos_cliente', 'contratos'];

  for (const bucketName of buckets) {
    const { data: existingBucket, error } = await supabase.storage.getBucket(bucketName);
    
    if (existingBucket && !error) {
      console.log(`✅ El bucket '${bucketName}' ya existe.`);
    } else {
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true, // we set to public for easy download URLs right now
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/jpg', 'application/pdf'],
        fileSizeLimit: 10485760 // 10 MB
      });

      if (createError) {
        console.error(`❌ Error al crear bucket '${bucketName}':`, createError.message);
      } else {
        console.log(`✅ Bucket '${bucketName}' creado con éxito.`);
      }
    }
  }
}

main().catch(console.error);
