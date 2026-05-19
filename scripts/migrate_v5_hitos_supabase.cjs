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

async function runMigration() {
  const hitos = [
    { orden: 1, nombre: 'Primer Contacto y Documentos', descripcion: 'Videollamada, definición de Objeto Social y Consejo Directivo.' },
    { orden: 2, nombre: 'Solicitud de Nombre (Sec. Economía)', descripcion: 'Trámite de denominación social en la plataforma de Economía.' },
    { orden: 3, nombre: 'Redacción de Proyecto de Acta', descripcion: 'Elaboración del proyecto, revisión y envío al cliente para firmas.' },
    { orden: 4, nombre: 'Recepción Física de Acta', descripcion: 'Recepción del documento firmado en físico con anexos originales.' },
    { orden: 5, nombre: 'Protocolización en Notaría', descripcion: 'Gestión con notario para la obtención del Testimonio Notarial.' },
    { orden: 6, nombre: 'Cita SAT e Inscripción', descripcion: 'Obtención de RFC Moral y e.firma de la Asociación Civil.' },
    { orden: 7, nombre: 'Ingreso Trámite Donataria', descripcion: 'Ingreso formal del trámite de autorización de donataria.' },
    { orden: 8, nombre: 'Aprobación Donataria', descripcion: 'Resolución favorable y obtención del oficio.' }
  ];

  console.log('Iniciando migración con Supabase client...');

  // 1. Get hitos to delete
  const { data: oldHitos } = await supabase.from('catalogo_hitos').select('id').lt('orden', 100);
  if (oldHitos && oldHitos.length > 0) {
    const ids = oldHitos.map(h => h.id);
    console.log('Borrando seguimiento_tareas vinculadas...');
    await supabase.from('seguimiento_tareas').delete().in('hito_id', ids);
    console.log('Borrando hitos antiguos...');
    await supabase.from('catalogo_hitos').delete().in('id', ids);
  }

  // 2. Insert new hitos
  console.log('Insertando nuevos hitos...');
  const { error } = await supabase.from('catalogo_hitos').insert(hitos);

  if (error) {
    console.error('Error al insertar hitos:', error);
  } else {
    console.log('Migración completada exitosamente.');
  }
}

runMigration();
