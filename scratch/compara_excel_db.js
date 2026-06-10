const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
    const [key, ...val] = line.split('=');
    if (key && val.length) acc[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
    return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log('--- Loading DB Data ---');
    const { data: dbPerfiles } = await supabase.from('perfiles').select('*');
    const { data: dbExpedientes } = await supabase.from('expedientes').select('*');
    const { data: dbConcentrado } = await supabase.from('datos_concentrado').select('*');

    console.log(`DB Stats: Perfiles: ${dbPerfiles.length}, Expedientes: ${dbExpedientes.length}, Concentrado: ${dbConcentrado.length}`);

    console.log('\n--- Loading Excel Data ---');
    const concentradoPath = path.join(process.cwd(), 'informacion', 'CONCENTRADO DE CONTRATOS EN SEGUIMIENTO.xlsx');
    const workbook = xlsx.readFile(concentradoPath);
    const sheetName = workbook.SheetNames[0];
    const excelRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    
    const headers = excelRows[0];
    const dataRows = excelRows.slice(1);

    const duplicates = [];
    const uniqueInExcel = new Map();
    const toImport = [];

    dataRows.forEach((row, idx) => {
        if (!row[2] && !row[4]) return; // Skip empty rows

        const cliente = (row[2] || '').toString().trim();
        const empresa = (row[4] || '').toString().trim();
        
        const key = `${cliente.toLowerCase()}|${empresa.toLowerCase()}`;

        if (uniqueInExcel.has(key)) {
            duplicates.push({ row: idx + 2, cliente, empresa, type: 'Excel Duplicate' });
            // Compare which one has more info
            const existing = uniqueInExcel.get(key);
            const currentInfoCount = row.filter(c => c !== null && c !== undefined && c !== '').length;
            const existingInfoCount = existing.row.filter(c => c !== null && c !== undefined && c !== '').length;
            
            if (currentInfoCount > existingInfoCount) {
                uniqueInExcel.set(key, { row, idx: idx + 2 });
            }
        } else {
            uniqueInExcel.set(key, { row, idx: idx + 2 });
        }
    });

    console.log(`Unique items in Excel: ${uniqueInExcel.size}`);
    console.log(`Duplicates in Excel: ${duplicates.length}`);

    const existingPerfilesMap = new Map(dbPerfiles.map(p => [p.nombre_completo.toLowerCase(), p]));
    const existingExpedientesMap = new Map(dbExpedientes.map(e => [e.nombre_empresa.toLowerCase(), e]));

    for (const [key, { row, idx }] of uniqueInExcel) {
        const cliente = (row[2] || '').toString().trim();
        const empresa = (row[4] || '').toString().trim();

        const dbPerfil = existingPerfilesMap.get(cliente.toLowerCase());
        const dbExpediente = existingExpedientesMap.get(empresa.toLowerCase());

        if (dbPerfil && dbExpediente) {
            // Check if concentrado entry exists
            const hasConcentrado = dbConcentrado.some(c => c.expediente_id === dbExpediente.id);
            if (!hasConcentrado) {
                toImport.push({ type: 'Missing Concentrado', row, idx, dbPerfil, dbExpediente });
            } else {
                // Potential update? (Optional for now)
            }
        } else {
            toImport.push({ type: 'New Record', row, idx });
        }
    }

    console.log(`Records to Import/Process: ${toImport.length}`);

    // Create Report
    let report = 'REPORTE DE DUPLICADOS Y REGISTROS NO IMPORTADOS\n';
    report += '================================================\n\n';
    duplicates.forEach(d => {
        report += `Fila ${d.row}: Cliente: ${d.cliente}, Empresa: ${d.empresa} (${d.type})\n`;
    });

    fs.writeFileSync('reporte_duplicados.txt', report);
    console.log('\nReport generated: reporte_duplicados.txt');
    
    // Save toImport for the next step
    fs.writeFileSync('scratch/to_import.json', JSON.stringify(toImport, null, 2));
}

run();
