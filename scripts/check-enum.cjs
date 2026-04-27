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
  const { data, error } = await supabase.rpc('get_enum_values', { enum_name: 'estatus_expediente' });
  if (error) {
    // try direct query
    const { data: qData, error: qErr } = await supabase.from('expedientes').select('estatus').limit(1);
    console.log(qErr);
  }
  console.log(data);
})();
