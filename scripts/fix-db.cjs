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
    // Buscar los que sí tienen documentos para ponerlos en revision_directora
    const { data: expedientes } = await supabase.from('expedientes').select('id, cliente_id').eq('estatus', 'en_registro');
    if (!expedientes) return;
    for (const exp of expedientes) {
        const { data: docs } = await supabase.from('documentos').select('id').eq('expediente_id', exp.id);
        if (docs && docs.length >= 3) {
            await supabase.from('expedientes').update({ estatus: 'revision_directora'}).eq('id', exp.id);
            console.log('✅ Formulario de cliente ' + exp.cliente_id + ' avanzado a revision_directora');
        }
    }
})();
