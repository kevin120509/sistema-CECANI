const xlsx = require('xlsx');
const path = require('path');

function extractAbogadas() {
    const filePath = path.join(process.cwd(), 'informacion', 'CONCENTRADO DE CONTRATOS EN SEGUIMIENTO.xlsx');
    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
        
        const dataRows = json.slice(1);
        const abogadas = new Set();
        
        dataRows.forEach(row => {
            const abogada = row[3]; // Columna D: ASESORA CECANI ENCARGADA
            if (abogada && typeof abogada === 'string' && abogada.trim() !== '') {
                // Limpiar el nombre de espacios extras y saltos de línea
                const cleanName = abogada.replace(/\r?\n|\r/g, ' ').trim();
                abogadas.add(cleanName);
            }
        });
        
        const sortedAbogadas = Array.from(abogadas).sort();
        console.log("=== LISTA DE ABOGADAS EN EL EXCEL ===");
        sortedAbogadas.forEach(a => console.log(a));
        
    } catch (e) {
        console.error('Error reading excel:', e.message);
    }
}

extractAbogadas();
