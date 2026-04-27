const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: expedientes } = await supabase.from('expedientes').select('id').limit(1);
  if (expedientes && expedientes.length > 0) {
    const { error } = await supabase.from('expedientes').update({ estatus: 'esperando_firma_cliente' }).eq('id', expedientes[0].id);
    console.log('Update Error:', error);
  }
})();
