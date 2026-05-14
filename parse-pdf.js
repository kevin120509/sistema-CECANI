const fs = require('fs');
const PDFParser = require('pdf2json');

const pdfParser = new PDFParser(this, 1); // 1 = raw text
const filePath = 'informacion/CONTRATO_AC 0_HILDA ESMERALDA RODRÍGUEZ ROSALES.pdf';

pdfParser.on('pdfParser_dataError', errData => console.error(errData.parserError) );
pdfParser.on('pdfParser_dataReady', pdfData => {
  fs.writeFileSync('pdf-text-dump.txt', pdfParser.getRawTextContent());
  console.log('PDF text extracted successfully.');
});

pdfParser.loadPDF(filePath);
