require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function mapRawToLawyers(raw) {
  let str = raw.replace(/"/g, '').replace('ASESORA', '').replace('ABOGADA', '').trim().toUpperCase();
  const tokens = str.split(/[-Y,]| Y | \/ /).map(s => s.trim()).filter(s => s.length > 0);
  
  const assigned = [];
  for (const token of tokens) {
    if (token.includes('ABI')) assigned.push('Abigail');
    else if (token.includes('ALE') || token.includes('CHAVIRA')) assigned.push('Alejandra Chavira');
    else if (token.includes('ARA')) assigned.push('Araceli');
    else if (token.includes('BLANCA')) assigned.push('Blanca Briceño');
    else if (token.includes('CLAU')) assigned.push('Claudia');
    else if (token.includes('DALIA')) assigned.push('Dalia');
    else if (token.includes('FILI')) assigned.push('Filiberta Reyes Guerrero');
    else if (token.includes('FLOR')) assigned.push('Flor');
    else if (token.includes('JORGE')) assigned.push('Jorge Eduardo Quiztian');
    else if (token.includes('KENIA')) assigned.push('Kenia Nextle');
    else if (token.includes('LUIZ') || token.includes('LUIS')) assigned.push('Luisa Enríquez');
    else if (token.includes('MIRTA')) assigned.push('Mirta');
    else if (token.includes('NERE')) assigned.push('Nereyda');
    else if (token.includes('NIZA') || token.includes('NZA')) assigned.push('Niza Guerra');
    else if (token.includes('ODETTE')) assigned.push('Odette');
    else if (token.includes('SANDRA')) assigned.push('Sandra');
    else if (token.includes('SELE')) assigned.push('Selena');
    else if (token.includes('VALE')) assigned.push('Valeria');
    else if (token.includes('YAEL')) assigned.push('Yael Matadamas López');
    else if (token.includes('YAR')) assigned.push('Yaraset Reyes');
    else if (token.includes('YESE')) assigned.push('Yesenia');
  }
  return [...new Set(assigned)];
}

async function main() {
  console.log("Fetching perfiles to build lawyer map...");
  const { data: existing } = await supabase.from('perfiles').select('id, nombre_completo');
  const lawyerMap = {};
  for (const p of existing) {
    if (p.nombre_completo) {
      lawyerMap[p.nombre_completo.trim()] = p.id;
    }
  }

  const assignments = []; 
  
  const file1 = path.join(__dirname, '../informes/reporte_multiples_abogadas ya asognado.txt');
  const content1 = fs.readFileSync(file1, 'utf8').split('\n');
  
  let currentClient = null;
  for (const line of content1) {
    const t = line.trim();
    if (t.startsWith('Fila') && t.includes('Cliente:')) {
      let client = t.split('Cliente:')[1].trim();
      if (client.includes('(')) client = client.split('(')[0].trim();
      currentClient = client;
    } else if (t.startsWith('- Texto original Excel:')) {
      const raw = t.replace('- Texto original Excel:', '');
      const mapped = mapRawToLawyers(raw);
      if (currentClient && mapped.length > 0) {
        assignments.push({ client: currentClient, lawyers: mapped });
      }
    }
  }

  const file2 = path.join(__dirname, '../informes/reporte_asignacion_abogadas.txt');
  const content2 = fs.readFileSync(file2, 'utf8').split('\n');
  
  let currentAssignedLawyer = null;
  for (const line of content2) {
    const t = line.trim();
    if (t.startsWith('ABOGADA:')) {
      const rawName = t.split('ABOGADA:')[1].split('(TOTAL')[0].trim();
      currentAssignedLawyer = mapRawToLawyers(rawName)[0];
    } else if (t.match(/^\d+\./) && currentAssignedLawyer) {
      let client = t.replace(/^\d+\.\s*/, '').trim();
      if (client.includes('(')) client = client.split('(')[0].trim();
      assignments.push({ client, lawyers: [currentAssignedLawyer] });
    }
  }
  
  console.log(`Total assignments to process: ${assignments.length}`);
  const { data: expedientes } = await supabase.from('expedientes').select('id, nombre_empresa');
  
  const relsToInsert = [];
  const expedientesToUpdate = [];
  let matched = 0;

  for (const assign of assignments) {
    const target = expedientes.find(e => e.nombre_empresa.toLowerCase() === assign.client.toLowerCase() || e.nombre_empresa.toLowerCase().includes(assign.client.toLowerCase()));
    if (target) {
      matched++;
      const ids = assign.lawyers.map(l => lawyerMap[l]).filter(Boolean);
      
      if (ids.length > 0) {
        expedientesToUpdate.push({ id: target.id, asesora_id: ids[0] });
        for (const id of ids) {
          relsToInsert.push({ expediente_id: target.id, asesora_id: id });
        }
      }
    }
  }
  
  console.log(`Matched ${matched} expedientes. Batch updating ${expedientesToUpdate.length} exps and inserting ${relsToInsert.length} relationships.`);
  
  // Batch insert into expediente_asesoras
  if (relsToInsert.length > 0) {
    const chunkSize = 200;
    for (let i = 0; i < relsToInsert.length; i += chunkSize) {
      const chunk = relsToInsert.slice(i, i + chunkSize);
      const { error } = await supabase.from('expediente_asesoras').upsert(chunk, { onConflict: 'expediente_id, asesora_id' });
      if (error) console.error("Error upserting chunk:", error);
    }
    console.log("Upserted relationships.");
  }
  
  // Batch update expedientes (using upsert on expedientes requires other required fields, so maybe just normal updates)
  // Since update is slow, let's use a Promise.all for expedientes
  const updatePromises = expedientesToUpdate.map(async (exp) => {
    return supabase.from('expedientes').update({ asesora_id: exp.asesora_id }).eq('id', exp.id);
  });
  
  await Promise.all(updatePromises);
  console.log("Finished updating expedientes.");
}

main().catch(console.error);
