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

async function run() {
    const { data: exp } = await supabase.from('expedientes').select('id').limit(1).single();
    if (!exp) return console.log('No exp');
    const { error } = await supabase.from('documentos').insert({
        expediente_id: exp.id,
        tipo: 'TIPO_PRUEBA_MIA',
        url_archivo: 'https://test.com/test.pdf'
    });
    console.log(error ? error.message : "Inserted successfully!");
}

run();