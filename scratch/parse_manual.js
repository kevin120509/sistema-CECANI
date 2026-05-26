const fs = require('fs');
const PDFParser = require('pdf2json');
const path = require('path');

const pdfParser = new PDFParser(null, 1); // 1 = raw text
const pdfPath = path.join(__dirname, '..', 'flujo', 'MANUAL ÁREA LEGAL.pdf');
const outputPath = path.join(__dirname, 'manual_legal_text.txt');

pdfParser.on('pdfParser_dataError', errData => console.error(errData.parserError));
pdfParser.on('pdfParser_dataReady', pdfData => {
  fs.writeFileSync(outputPath, pdfParser.getRawTextContent());
  console.log('PDF text extracted to scratch/manual_legal_text.txt');
});

pdfParser.loadPDF(pdfPath);
