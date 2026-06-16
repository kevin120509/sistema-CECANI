require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const LAWYERS = [
  "Abigail", "Alejandra Chavira", "Araceli", "Blanca Briceño", "Claudia", "Dalia", 
  "Filiberta Reyes Guerrero", "Flor", "Jorge Eduardo Quiztian", "Kenia Nextle", 
  "Luisa Enríquez", "Mirta", "Nereyda", "Niza Guerra", "Odette", "Sandra", 
  "Selena", "Valeria", "Yael Matadamas López", "Yaraset Reyes", "Yesenia"
];

function normalizeName(str) {
  return str.toUpperCase().trim();
}

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
  console.log("1. Creating missing lawyer accounts...");
  const lawyerMap = {};
  for (const name of LAWYERS) {
    const email = `${name.toLowerCase().replace(/ /g, '.').replace(/ñ/g, 'n').replace(/[íé]/g, 'e')}@cecani.com`;
    
    // Check if profile exists
    const { data: existing } = await supabase.from('perfiles').select('id').ilike('nombre_completo', `%${name}%`).single();
    
    if (existing) {
      lawyerMap[name] = existing.id;
    } else {
      // Create user
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password: 'Password123!',
        email_confirm: true,
        user_metadata: { full_name: name }
      });
      if (authErr) {
        console.error("Auth error for", name, authErr);
        continue;
      }
      const userId = authData.user.id;
      // Upsert profile
      await supabase.from('perfiles').upsert({
        id: userId,
        nombre_completo: name,
        telefono: '0000000000',
        estado: 'CDMX',
        rol: 'abogada'
      });
      lawyerMap[name] = userId;
      console.log("Created:", name);
    }
  }

  console.log("2. Processing reporte_multiples_abogadas ya asognado.txt");
  const file1 = path.join(__dirname, '../informes/reporte_multiples_abogadas ya asognado.txt');
  const content1 = fs.readFileSync(file1, 'utf8').split('\n');
  
  let currentClient = null;
  const assignments = []; // { clientName, lawyers: [] }
  
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

  console.log(`Parsed ${assignments.length} assignments from multiples.`);
  
  // Also parse reporte_asignacion_abogadas.txt
  console.log("3. Processing reporte_asignacion_abogadas.txt");
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
  
  console.log("4. Fetching all expedientes...");
  const { data: expedientes } = await supabase.from('expedientes').select('id, nombre_empresa');
  
  let matched = 0;
  for (const assign of assignments) {
    // Find expediente
    const target = expedientes.find(e => e.nombre_empresa.toLowerCase() === assign.client.toLowerCase() || e.nombre_empresa.toLowerCase().includes(assign.client.toLowerCase()));
    
    if (target) {
      matched++;
      const ids = assign.lawyers.map(l => lawyerMap[l]).filter(Boolean);
      
      if (ids.length > 0) {
        // Update main asesora_id
        await supabase.from('expedientes').update({ asesora_id: ids[0] }).eq('id', target.id);
        
        // Insert into expediente_asesoras
        const rels = ids.map(id => ({ expediente_id: target.id, asesora_id: id }));
        await supabase.from('expediente_asesoras').upsert(rels, { onConflict: 'expediente_id, asesora_id' });
      }
    }
  }
  
  console.log(`Matched and updated ${matched} expedientes.`);
}

main().catch(console.error);
