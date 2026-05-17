const XLSX = require('xlsx');
const path = require('path');

function inspectExcel(filename) {
    console.log(`\n=== Inspeccionando: ${filename} ===`);
    try {
        const filePath = path.join(process.cwd(), 'informacion', filename);
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }).slice(0, 10);
        console.log('Encabezados/Primeras filas:');
        data.forEach((row, i) => {
            console.log(`Fila ${i}:`, row);
        });
    } catch (e) {
        console.error('Error leyendo archivo:', e.message);
    }
}

inspectExcel('CONCENTRADO DE CONTRATOS EN SEGUIMIENTO.xlsx');
inspectExcel('SEGUIMIENTO DE PROCESO.xlsx');
