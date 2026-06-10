const xlsx = require('xlsx');
const path = require('path');

function analyzeNames() {
    const filePath = path.join(process.cwd(), 'informacion', 'CONCENTRADO DE CONTRATOS EN SEGUIMIENTO.xlsx');
    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
        
        const dataRows = json.slice(1);
        const rawAbogadas = new Set();
        
        dataRows.forEach(row => {
            const abogada = row[3];
            if (abogada && typeof abogada === 'string' && abogada.trim() !== '') {
                rawAbogadas.add(abogada.replace(/\r?\n|\r/g, ' ').trim().toUpperCase());
            }
        });
        
        const individualNames = new Set();
        
        rawAbogadas.forEach(raw => {
            // Split by common separators: -, /, " y ", "," and multiple spaces
            const parts = raw.split(/[\/\-]| Y |,|  +/i);
            parts.forEach(part => {
                const cleanPart = part.trim().toUpperCase();
                if (cleanPart !== '') {
                    individualNames.add(cleanPart);
                }
            });
        });
        
        console.log("=== NOMBRES INDIVIDUALES EXTRAIDOS ===");
        Array.from(individualNames).sort().forEach(a => console.log(a));
        
    } catch (e) {
        console.error('Error reading excel:', e.message);
    }
}

analyzeNames();
