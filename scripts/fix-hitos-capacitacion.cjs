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

// Columnas exactas del Excel "SEGUIMIENTO DE PROCESO" (cronograma del trámite)
const seguimientoColumnas = [
  'DOCUMENTOS',
  'REGISTRO DEL NOMBRE',
  'ELABORACION DE ACTA',
  'ENVIO DE ACTA AL CLIENTE PARA REVISION',
  'PROTOCOLIZACION DEL ACTA',
  'SOLICITUD DE CITA EN SAT',
  'INSCRIPCION DE RFC',
  'SOLICITUD DE CITA EN SAT (E.FIRMA)',
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
  // 1. Borrar hitos de capacitacion anteriores (orden >= 101)
  console.log('Borrando hitos de capacitacion anteriores...');
  const { error: delErr } = await supabaseAdmin
    .from('catalogo_hitos')
    .delete()
    .gte('orden', 101);
  if (delErr) console.error('Error borrando:', delErr);

  // 2. Insertar los nuevos hitos del Excel "SEGUIMIENTO DE PROCESO"
  console.log('Insertando hitos del Excel SEGUIMIENTO DE PROCESO...');
  const newHitos = seguimientoColumnas.map((nombre, idx) => ({
    nombre,
    orden: 101 + idx  // 101-117
  }));

  const { data, error } = await supabaseAdmin.from('catalogo_hitos').insert(newHitos).select();
  if (error) {
    console.error('Error insertando:', error);
  } else {
    console.log('Hitos insertados:', data.length);
    data.forEach(h => console.log(`  ${h.orden}: ${h.nombre} (id: ${h.id})`));
  }

  // 3. Verificar estado final
  const { data: all } = await supabaseAdmin.from('catalogo_hitos').select('*').order('orden');
  console.log('\n=== ESTADO FINAL DE HITOS ===');
  all.forEach(h => console.log(`  [${h.orden}] ${h.nombre} (id: ${h.id})`));
})();
