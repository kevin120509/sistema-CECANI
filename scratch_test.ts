import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: expedienteData, error } = await supabase
    .from('expedientes')
    .select('id, cliente_id, estatus, contratos(id, url_pdf_generado)')
    .eq('estatus', 'en_proceso')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !expedienteData) {
    console.error('Error fetching data:', error);
    return;
  }

  console.log('Expediente:', expedienteData);
  const contrato = (expedienteData.contratos as any)[0];

  if (!contrato.url_pdf_generado) {
    console.log('Trying to generate contract...');
    // We can just use node to dynamically import the server action since we are not in Next.js?
    // Actually, calling a next.js server action from pure node might fail due to "use server" or aliases.
    // Let's just look at the logs of the running next.js server!
  }
}

main();
