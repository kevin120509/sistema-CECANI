const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixPaymentSync() {
  const expId = '16280825-c9cd-470d-90aa-504136fe11d5';
  console.log(`--- Sincronizando validación para expediente: ${expId} ---`);

  // 1. Asegurar que el pago esté verificado
  const { error: e1 } = await supabase
    .from('pagos')
    .update({ verificado: true, motivo_rechazo: null })
    .eq('expediente_id', expId);
  
  if (e1) console.error('Error 1:', e1.message);
  else console.log('✅ Pago en tabla "pagos" verificado.');

  // 2. Asegurar que el documento 'comprobante_pago' esté validado
  const { error: e2 } = await supabase
    .from('documentos')
    .update({ validado: true, motivo_rechazo: null })
    .eq('expediente_id', expId)
    .eq('tipo', 'comprobante_pago');

  if (e2) console.error('Error 2:', e2.message);
  else console.log('✅ Documento "comprobante_pago" validado.');

  // 3. Verificación final
  const { data: check } = await supabase
    .from('documentos')
    .select('tipo, validado')
    .eq('expediente_id', expId)
    .eq('tipo', 'comprobante_pago')
    .single();
  
  console.log('ESTADO FINAL EN BD:', check);
}

fixPaymentSync();
