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

async function checkHitos() {
    const { data: hitos } = await supabase.from('catalogo_hitos').select('*').order('orden');
    console.log('Hitos:', hitos);
    
    // Check one of the missing ones to see if it really is missing
    const { data: expedientes } = await supabase.from('expedientes').select('*, perfiles!inner(*)').limit(5);
    console.log('Sample Expedientes:', JSON.stringify(expedientes, null, 2));
}

checkHitos();
