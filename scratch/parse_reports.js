const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function extractNames(rawText) {
  let text = rawText.replace(/"/g, '').replace('ASESORA', '').trim();
  text = text.toUpperCase();
  // split by '-', ' Y ', ','
  return text.split(/[-Y,]| Y | \/ /).map(s => s.trim()).filter(s => s.length > 0);
}

async function main() {
  const file1 = path.join(__dirname, '../informes/reporte_multiples_abogadas ya asognado.txt');
  const file2 = path.join(__dirname, '../informes/reporte_asignacion_abogadas.txt');
  
  const content1 = fs.readFileSync(file1, 'utf8');
  const content2 = fs.readFileSync(file2, 'utf8');
  
  // Parse reporte_multiples_abogadas ya asognado.txt
  // Format:
  // Fila X | Cliente: NOMBRE (REPRESENTANTE)
  // - Texto original Excel: "..."
  const lines1 = content1.split('\n');
  const multiplesMap = [];
  
  let currentClient = null;
  for (let i = 0; i < lines1.length; i++) {
    const line = lines1[i].trim();
    if (line.startsWith('Fila') && line.includes('Cliente:')) {
      // parse client name
      const parts = line.split('Cliente:');
      let namePart = parts[1].trim();
      if (namePart.includes('(')) {
        namePart = namePart.split('(')[0].trim();
      }
      currentClient = namePart;
    } else if (line.startsWith('- Texto original Excel:')) {
      const raw = line.replace('- Texto original Excel:', '').trim();
      const names = extractNames(raw);
      if (currentClient && names.length > 0) {
        multiplesMap.push({ client: currentClient, names, raw });
      }
    }
  }
  
  console.log("Parsed multiples:", multiplesMap.length);
  for (let i=0; i<10; i++) {
    console.log(multiplesMap[i]);
  }
  
  const { data: perfiles } = await supabase.from('perfiles').select('id, nombre_completo').in('rol', ['asesora', 'abogada']);
  
  console.log("Lawyers found:", perfiles.length);
  
}

main();
