import fs from 'fs';
import pdfParse from 'pdf-parse';

async function parsePDF() {
  const dataBuffer = fs.readFileSync('informacion/CONTRATO_AC 0_HILDA ESMERALDA RODRÍGUEZ ROSALES.pdf');
  try {
    const data = await pdfParse(dataBuffer);
    fs.writeFileSync('pdf-text-dump.txt', data.text);
    console.log('PDF text extracted to pdf-text-dump.txt');
  } catch (err) {
    console.error('Error parsing PDF:', err);
  }
}

parsePDF();
