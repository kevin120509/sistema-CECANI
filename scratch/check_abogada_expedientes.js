require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAbogadaExpedientes() {
  const email = 'kevin.36137@gmail.com';
  
  // 1. Get user ID from perfiles
  const { data: perfiles, error: pErr } = await supabase
    .from('perfiles')
    .select('*')
    .eq('email', email);
    
  if (pErr || !perfiles || perfiles.length === 0) {
    console.log('Error o no perfil:', pErr);
    return;
  }
  
  const userId = perfiles[0].id;
  console.log(`Usuario: ${email}, ID: ${userId}, ROL: ${perfiles[0].rol}`);
  
  // 2. Check legacy asesora_id
  const { data: expLegacy, error: eErr1 } = await supabase
    .from('expedientes')
    .select('id, nombre_empresa, asesora_id')
    .eq('asesora_id', userId);
    
  console.log('Expedientes por asesora_id (Legacy):', expLegacy);
  
  // 3. Check relacional
  const { data: expRel, error: eErr2 } = await supabase
    .from('expediente_asesoras')
    .select('*')
    .eq('asesora_id', userId);
    
  console.log('Relacional expediente_asesoras:', expRel);
}

checkAbogadaExpedientes();
