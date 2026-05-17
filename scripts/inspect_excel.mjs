import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

function inspectExcel(filename) {
    console.log(`\n=== Inspeccionando: ${filename} ===`);
    const filePath = path.join(process.cwd(), 'informacion', filename);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Obtener las primeras 5 filas para ver la estructura y encabezados
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }).slice(0, 5);
    console.log('Encabezados/Primeras filas:');
    data.forEach((row, i) => {
        console.log(`Fila ${i}:`, row);
    });
}

inspectExcel('CONCENTRADO DE CONTRATOS EN SEGUIMIENTO.xlsx');
inspectExcel('SEGUIMIENTO DE PROCESO.xlsx');
