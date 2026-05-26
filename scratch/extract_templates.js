const fs = require('fs');
const PDFParser = require('pdf2json');

function parsePdf(filePath, outputName) {
  const pdfParser = new PDFParser(null, 1);
  pdfParser.on('pdfParser_dataError', errData => console.error(errData.parserError) );
  pdfParser.on('pdfParser_dataReady', pdfData => {
    fs.appendFileSync('pdf-text-dump-all.txt', `\n--- ${filePath} ---\n`);
    fs.appendFileSync('pdf-text-dump-all.txt', pdfParser.getRawTextContent());
    console.log(`Finished ${filePath}`);
  });
  pdfParser.loadPDF(filePath);
}

const files = [
  'informacion/CONTRATO ACTA EXTRAORDINARIA_XXX-2026_BORRADOR.pdf',
  'informacion/SERVICIO INTEGRAL RECUPERACIÓN  DE DONATARIA 2026.pdf'
];

fs.writeFileSync('pdf-text-dump-all.txt', 'PDF TEXT EXTRACTION\n');
files.forEach(f => {
  if (fs.existsSync(f)) {
    parsePdf(f);
  } else {
    console.log(`File not found: ${f}`);
  }
});
