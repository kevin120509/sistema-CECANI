const fs = require('fs');
const path = require('path');
const PDFParser = require('pdf2json');

const pdfParser = new PDFParser(null, 1); // 1 = raw text
const pdfPath = path.join(__dirname, '../informacion/COTIZACIÓN SERVICIO DE CONSTITUCIÓN ASOCIACIÓN CIVIL Y DONATARIA 2026.pdf');

if (!fs.existsSync(pdfPath)) {
  console.error('PDF file does not exist at:', pdfPath);
  process.exit(1);
}

pdfParser.on('pdfParser_dataError', errData => console.error(errData.parserError) );
pdfParser.on('pdfParser_dataReady', pdfData => {
  const rawText = pdfParser.getRawTextContent();
  fs.writeFileSync(path.join(__dirname, 'cotizacion_raw_text.txt'), rawText);
  console.log('PDF text extracted successfully.');

  const lines = rawText.split('\n');
  const matches = [];
  lines.forEach((line, index) => {
    if (/descuento|pago|invers|contado|msi|meses|exhibic|tarjeta/i.test(line)) {
      matches.push({ lineNum: index + 1, content: line.trim() });
    }
  });

  console.log(`Found ${matches.length} matching lines.`);
  
  const dumpPath = path.join(__dirname, 'cotizacion_search_results.txt');
  const results = matches.map(m => `Line ${m.lineNum}: ${m.content}`).join('\n');
  fs.writeFileSync(dumpPath, results);
  console.log(`Wrote matches to ${dumpPath}`);
  
  // Display a sample of matches
  console.log('\n--- Sample of matches ---');
  matches.slice(0, 50).forEach(m => {
    console.log(`[Line ${m.lineNum}] ${m.content}`);
  });
});

pdfParser.loadPDF(pdfPath);
