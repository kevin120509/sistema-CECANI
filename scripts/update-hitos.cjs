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

const hitosExcel = [
  'CLIENTE',
  'ASOCIADOS',
  'OBJETO SOCIAL',
  'TRAMITE DE PERMISO SE',
  'PAGO DE DERECHO SE',
  'REUNION Y VALIDACION DE CONSTANCIAS',
  'FIRMA DE ACTA CONSTITUTIVA',
  'INSCRIPCION DE RFC',
  'SOLICITUD DE CITA EN SAT',
  'FIRMA ELECTRONICA',
  'INGRESO AL RPP',
  'TRAMITE DE CLUNI',
  'CURRICULUM',
  'REDES SOCIALES',
  'ARMADO DE EXPEDIENTE CONSTANCIA',
  'SOLICITUD DE CONSTANCIA',
  'INGRESO DE DONATARIA',
  'AUTORIZACION'
];

(async () => {
  console.log('Borrando hitos y tareas antiguas...');
  await supabaseAdmin.from('seguimiento_tareas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from('catalogo_hitos').delete().neq('id', 0); // Borra todos

  console.log('Insertando nuevos hitos...');
  const newHitos = hitosExcel.map((nombre, idx) => ({
    nombre,
    orden: idx + 1
  }));

  const { error } = await supabaseAdmin.from('catalogo_hitos').insert(newHitos);
  if (error) {
    console.error('Error insertando hitos:', error);
  } else {
    console.log('Hitos insertados con éxito.');
  }
})();
