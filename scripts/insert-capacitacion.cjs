const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

let supabaseUrl = '';
let supabaseServiceKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) supabaseServiceKey = line.split('=')[1].trim();
});

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const capacitacionItems = [
  'Manual de Negocios Entregado',
  'Accesos a la Plataforma CECANI Enviados',
  'Kit de Bienvenida Corporativa',
  'Sesión de Asesoría Inicial (1hr) Realizada',
  'Formato de Responsabilidades Fiscales Explicado'
];

(async () => {
  console.log('Insertando hitos de capacitacion...');
  const newHitos = capacitacionItems.map((nombre, idx) => ({
    nombre,
    orden: 101 + idx
  }));

  const { error } = await supabaseAdmin.from('catalogo_hitos').insert(newHitos);
  if (error) {
    console.error('Error insertando hitos:', error);
  } else {
    console.log('Hitos de capacitacion insertados con éxito.');
  }
})();
