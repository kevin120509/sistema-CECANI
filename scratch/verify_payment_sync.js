const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyPaymentFlow() {
  console.log('--- Verificando Tabla PAGOS ---');
  const { data: pagos, error: err1 } = await supabase
    .from('pagos')
    .select('id, monto, verificado, motivo_rechazo, expediente_id')
    .order('created_at', { ascending: false })
    .limit(5);

  if (err1) {
    console.error('Error en pagos:', err1.message);
  } else {
    console.log('Ultimos 5 pagos:', JSON.stringify(pagos, null, 2));
  }

  console.log('\n--- Verificando Tabla DOCUMENTOS (comprobante_pago) ---');
  const { data: docs, error: err2 } = await supabase
    .from('documentos')
    .select('id, tipo, validado, motivo_rechazo, expediente_id')
    .eq('tipo', 'comprobante_pago')
    .order('created_at', { ascending: false })
    .limit(5);

  if (err2) {
    console.error('Error en documentos:', err2.message);
  } else {
    console.log('Ultimos 5 comprobantes de pago:', JSON.stringify(docs, null, 2));
  }
}

verifyPaymentFlow();
