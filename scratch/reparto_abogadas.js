const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

function analyzeDistribution() {
    const filePath = path.join(process.cwd(), 'informacion', 'CONCENTRADO DE CONTRATOS EN SEGUIMIENTO.xlsx');
    
    // Matriz de mapeo oficial (21 abogadas)
    const mapping = {
        'ABI': 'Abigail',
        'ABY': 'Abigail',
        'ABIGAIL': 'Abigail',
        'ALE CHAVIRA': 'Alejandra Chavira',
        'CHAVIRA': 'Alejandra Chavira',
        'ALEJANDRA': 'Alejandra Chavira',
        'ARACELI': 'Araceli',
        'ARECELI': 'Araceli',
        'BLANCA BRICEÑO': 'Blanca Briceño',
        'CLAUDIA': 'Claudia',
        'DALIA': 'Dalia',
        'FILIBERTA REYES GUERRERO': 'Filiberta Reyes Guerrero',
        'FLOR': 'Flor',
        'JORGE EDUARDO QUIZTIAN': 'Jorge Eduardo Quiztian',
        'KENIA': 'Kenia Nextle',
        'NEXTLE': 'Kenia Nextle',
        'KENIA NEXTLE': 'Kenia Nextle',
        'LUISA': 'Luisa Enríquez',
        'LUIZA': 'Luisa Enríquez',
        'LUISA ENRIQUEZ': 'Luisa Enríquez',
        'MIRTA': 'Mirta',
        'NEREYDA': 'Nereyda',
        'NIZA': 'Niza Guerra',
        'NZA GUERRA': 'Niza Guerra',
        'NIZA GUERRA': 'Niza Guerra',
        'CHAVIRA7 NIZA GUERRA': 'Niza Guerra', // Special case mapping
        'ODETTE': 'Odette',
        'SANDRA': 'Sandra',
        'SELENA': 'Selena',
        'VALE': 'Valeria',
        'VALERIA': 'Valeria',
        'YAEL MATADAMAS LOPEZ': 'Yael Matadamas López',
        'YAR': 'Yaraset Reyes',
        'YARASET': 'Yaraset Reyes',
        'YARASET REYES': 'Yaraset Reyes',
        'YESENIA': 'Yesenia'
    };

    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
        
        const dataRows = json.slice(1);
        
        const singleAssign = new Map(); // Abogada Name -> array of clients
        const multipleAssign = []; // Array of clients with multiple abogadas
        let sinAsignarCount = 0;

        dataRows.forEach((row, index) => {
            const clienteStr = row[2] || '';
            const empresaStr = row[4] || '';
            const abogadaCell = row[3];
            
            if (!clienteStr && !empresaStr) return; // Empty row
            
            const displayClient = `${empresaStr} (${clienteStr})`.trim();

            if (!abogadaCell || typeof abogadaCell !== 'string' || abogadaCell.trim() === '') {
                sinAsignarCount++;
                return;
            }

            // Normalizar y separar
            const raw = abogadaCell.replace(/\r?\n|\r/g, ' ').trim().toUpperCase();
            
            const parts = raw.split(/[\/\-]| Y |,|  +/i);
            const assignedAbogadas = new Set();

            parts.forEach(part => {
                const cleanPart = part.trim();
                // Special exception for CHAVIRA7 NIZA GUERRA which splits poorly
                if (cleanPart === 'CHAVIRA7 NIZA GUERRA') {
                    assignedAbogadas.add('Alejandra Chavira');
                    assignedAbogadas.add('Niza Guerra');
                } else if (mapping[cleanPart]) {
                    assignedAbogadas.add(mapping[cleanPart]);
                } else if (cleanPart !== '') {
                    // Fallback
                    assignedAbogadas.add(cleanPart);
                }
            });

            const uniqueList = Array.from(assignedAbogadas);

            if (uniqueList.length === 1) {
                const abogadaName = uniqueList[0];
                if (!singleAssign.has(abogadaName)) {
                    singleAssign.set(abogadaName, []);
                }
                singleAssign.get(abogadaName).push(displayClient);
            } else if (uniqueList.length > 1) {
                multipleAssign.push({
                    cliente: displayClient,
                    abogadas: uniqueList.join(' y '),
                    rawText: raw,
                    fila: index + 2
                });
            }
        });

        // ==========================
        // CREATE SINGLE REPORT
        // ==========================
        let singleReport = "=== REPORTE DE ASIGNACION DE ABOGADAS (CLIENTES INDIVIDUALES) ===\n\n";
        
        // Sort keys alphabetically
        const sortedAbogadas = Array.from(singleAssign.keys()).sort();
        
        sortedAbogadas.forEach(abo => {
            const clients = singleAssign.get(abo);
            singleReport += `-------------------------------------------------\n`;
            singleReport += `ABOGADA: ${abo} (TOTAL: ${clients.length} clientes)\n`;
            singleReport += `-------------------------------------------------\n`;
            clients.forEach((c, i) => {
                singleReport += `${i + 1}. ${c}\n`;
            });
            singleReport += `\n`;
        });
        
        fs.writeFileSync(path.join(process.cwd(), 'reporte_asignacion_abogadas.txt'), singleReport);

        // ==========================
        // CREATE MULTIPLE REPORT
        // ==========================
        let multipleReport = `=== REPORTE DE CLIENTES CON MÚLTIPLES ABOGADAS (${multipleAssign.length} casos) ===\n`;
        multipleReport += `Por favor, verifique estos clientes y decida qué abogada será la titular principal.\n\n`;

        multipleAssign.forEach(m => {
            multipleReport += `Fila ${m.fila} | Cliente: ${m.cliente}\n`;
            multipleReport += `   - Texto original Excel: "${m.rawText}"\n`;
            multipleReport += `   - Detectadas: ${m.abogadas}\n\n`;
        });

        fs.writeFileSync(path.join(process.cwd(), 'reporte_multiples_abogadas.txt'), multipleReport);

        console.log(`Reports created successfully!`);
        console.log(`- reporte_asignacion_abogadas.txt (Single Assignments)`);
        console.log(`- reporte_multiples_abogadas.txt (Multiple Assignments: ${multipleAssign.length} casos)`);
        console.log(`- Clientes sin asesora: ${sinAsignarCount}`);

    } catch (e) {
        console.error('Error analyzing distribution:', e.message);
    }
}

analyzeDistribution();