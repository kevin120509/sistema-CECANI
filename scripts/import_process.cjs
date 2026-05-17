const XLSX = require('xlsx');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function importProcess() {
  console.log('--- Iniciando Importación de Seguimiento de Proceso (Verboso) ---');
  const filePath = path.join(process.cwd(), 'informacion', 'SEGUIMIENTO DE PROCESO.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  
  // Usar defval para no omitir columnas vacías
  const data = XLSX.utils.sheet_to_json(sheet, { range: 1, defval: false });

  const { data: catHitos } = await supabase.from('catalogo_hitos').select('*').order('orden');
  
  for (const row of data) {
    const nombreCliente = row['Nombre del cliente'];
    const nombreEmpresa = row['Nombre de la A.C '];
    
    if (!nombreCliente || !nombreEmpresa) continue;

    const { data: exp } = await supabase
      .from('expedientes')
      .select('id')
      .ilike('nombre_empresa', `%${nombreEmpresa}%`)
      .maybeSingle();

    if (!exp) {
      console.log(`- Skipping ${nombreEmpresa}: No existe expediente.`);
      continue;
    }

    const columnasExcel = [
      'DOCUMENTOS', 'REGISTRO DEL NOMBRE', 'ELABORACION DE ACTA',
      'ENVIO DE ACTA AL CLIENTE PARA REVISION', 'PROTOCOLIZACION DEL ACTA',
      'SOLICITUD DE CITA EN SAT', 'INSCRIPCION DE RFC', 'SOLICITUD DE CITA EN SAT',
      'FIRMA ELECTRONICA', 'INGRESO AL RPP', 'TRAMITE DE CLUNI', 'CURRICULUM',
      'REDES SOCIALES ', 'ARMADO DE EXPEDIENTE CONSTANCIA ', 'SOLICITUD DE CONSTANCIA ',
      'INGRESO DE DONATARIA ', 'AUTORIZACION '
    ];

    let count = 0;
    for (let i = 0; i < catHitos.length && i < columnasExcel.length; i++) {
      const hito = catHitos[i];
      const valor = row[columnasExcel[i]];

      if (valor === true || valor === 'TRUE' || valor === 'SI' || valor === 1) {
        await supabase.from('seguimiento_tareas').upsert({
          expediente_id: exp.id,
          hito_id: hito.id,
          estatus: 'completado',
          fecha_completado: new Date().toISOString()
        }, { onConflict: 'expediente_id,hito_id' });
        count++;
      }
    }
    console.log(`- ${nombreEmpresa}: ${count} hitos actualizados.`);
  }
}

importProcess();
