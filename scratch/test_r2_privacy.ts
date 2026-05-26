import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Querying documentos table for an existing file URL...');
  
  const { data: documentos, error } = await supabase
    .from('documentos')
    .select('url_archivo')
    .not('url_archivo', 'is', null)
    .limit(1);

  let targetUrl = '';
  if (error || !documentos || documentos.length === 0) {
    console.log('No documents found in documentos table. Checking contratos table...');
    const { data: contratos, error: contrError } = await supabase
      .from('contratos')
      .select('url_pdf_generado, url_pdf_firmado_cliente, url_pdf_doble_firma')
      .limit(1);
    
    if (contrError || !contratos || contratos.length === 0) {
      console.log('No files found in database. Using R2_PUBLIC_URL configuration...');
      const publicUrl = process.env.R2_PUBLIC_URL;
      if (publicUrl) {
        targetUrl = `${publicUrl.endsWith('/') ? publicUrl : publicUrl + '/'}_non_existent_test_file_to_check_privacy.pdf`;
      }
    } else {
      const c = contratos[0];
      targetUrl = c.url_pdf_generado || c.url_pdf_firmado_cliente || c.url_pdf_doble_firma || '';
    }
  } else {
    targetUrl = documentos[0].url_archivo;
  }

  if (!targetUrl) {
    console.error('Could not determine a target URL to check.');
    return;
  }

  console.log(`Checking URL: ${targetUrl}`);

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        // No headers/credentials to simulate anonymous access
      }
    });

    console.log(`HTTP Status Code: ${res.status}`);
    console.log(`HTTP Status Text: ${res.statusText}`);
    
    if (res.status === 403 || res.status === 401) {
      console.log('SUCCESS: The bucket is PRIVATE. Anonymous access is forbidden.');
    } else if (res.status === 200) {
      console.log('WARNING: The file was retrieved successfully (HTTP 200). The bucket is still PUBLIC.');
    } else {
      console.log(`Response received: HTTP ${res.status}. If this is a 404 and you used a non-existent file, we need to test with an actual file.`);
      
      // Let's also test a known non-existent file path under the R2 public URL
      const publicUrl = process.env.R2_PUBLIC_URL;
      if (publicUrl) {
        const testNonExistent = `${publicUrl.endsWith('/') ? publicUrl : publicUrl + '/'}_test_non_existent.pdf`;
        console.log(`Testing a non-existent path: ${testNonExistent}`);
        const resNonExistent = await fetch(testNonExistent);
        console.log(`Non-existent URL HTTP Status: ${resNonExistent.status}`);
        if (resNonExistent.status === 403 || resNonExistent.status === 401) {
          console.log('SUCCESS: Access to non-existent path is also forbidden (typical of private buckets).');
        } else {
          console.log('NOTE: Non-existent path returned status:', resNonExistent.status);
        }
      }
    }
  } catch (err: any) {
    console.error('Error fetching the URL:', err.message);
  }
}

main();
