import fs from 'fs';
import pdfParse from 'pdf-parse';
import path from 'path';

async function parsePDF() {
  const pdfPath = path.join(process.cwd(), 'flujo', 'MANUAL ÁREA LEGAL.pdf');
  const outputPath = path.join(process.cwd(), 'scratch', 'manual_legal_text.txt');
  const dataBuffer = fs.readFileSync(pdfPath);
  try {
    const data = await pdfParse(dataBuffer);
    fs.writeFileSync(outputPath, data.text);
    console.log('PDF text extracted to scratch/manual_legal_text.txt');
  } catch (err) {
    console.error('Error parsing PDF:', err);
  }
}

parsePDF();
