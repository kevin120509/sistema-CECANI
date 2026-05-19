const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
  return acc;
}, {});

const connectionString = env.SUPABASE_DB_URL || env.DATABASE_URL;

const client = new Client({
  connectionString: connectionString,
});

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

  try {
    await client.connect();
    
    // Begin Transaction
    await client.query('BEGIN');

    // Delete existing hitos under 100 (legal milestones)
    await client.query('DELETE FROM seguimiento_tareas WHERE hito_id IN (SELECT id FROM catalogo_hitos WHERE orden < 100)');
    await client.query('DELETE FROM catalogo_hitos WHERE orden < 100');

    // Insert new hitos
    for (const hito of hitos) {
      await client.query(
        'INSERT INTO catalogo_hitos (nombre, descripcion, orden) VALUES ($1, $2, $3)',
        [hito.nombre, hito.descripcion, hito.orden]
      );
    }

    await client.query('COMMIT');
    console.log('Migración de hitos completada exitosamente.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en migración:', err);
  } finally {
    await client.end();
  }
}

runMigration();
