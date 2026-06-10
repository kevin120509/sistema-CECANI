const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

function inspectExcel(filename) {
    const filePath = path.join(process.cwd(), 'informacion', filename);
    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        return;
    }
    console.log(`\n--- Inspecting: ${filename} ---`);
    try {
        const workbook = xlsx.readFile(filePath);
        console.log('Sheet Names:', workbook.SheetNames);
        
        workbook.SheetNames.forEach(sheetName => {
            console.log(`\nSheet: ${sheetName}`);
            const worksheet = workbook.Sheets[sheetName];
            const json = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
            
            // Print first 5 rows to understand the structure
            for(let i = 0; i < Math.min(10, json.length); i++) {
                console.log(`Row ${i + 1}:`, json[i]);
            }
        });
    } catch (e) {
        console.error('Error reading excel:', e.message);
    }
}

inspectExcel('CONCENTRADO DE CONTRATOS EN SEGUIMIENTO.xlsx');
inspectExcel('SEGUIMIENTO DE PROCESO.xlsx');
