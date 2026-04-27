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
    const { data: expedientes, error } = await supabase.from('expedientes').select('id, nombre_empresa, estatus, cliente_id').order('created_at', { ascending: false});
    if (error) console.error(error);
    console.log(JSON.stringify(expedientes, null, 2));
    
    const { data: perfiles } = await supabase.from('perfiles').select('*');
    console.log('Perfiles:', perfiles);

    const { data: documentos } = await supabase.from('documentos').select('*');
    console.log('Docs:', documentos.length);
})();
