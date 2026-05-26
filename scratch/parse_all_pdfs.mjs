import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const infoDir = path.join(projectRoot, 'informacion');
const outputFile = path.join(projectRoot, 'scratch', 'pdf_summaries.txt');

let outputContent = '';

function logOutput(msg) {
  outputContent += msg + '\n';
  console.log(msg);
}

async function scanPdfs(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      await scanPdfs(filePath);
    } else if (file.toLowerCase().endsWith('.pdf')) {
      logOutput(`\n==================================================`);
      logOutput(`FILE: ${path.relative(projectRoot, filePath)} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
      logOutput(`==================================================`);
      try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        
        const text = data.text;
        
        // Find price mentions
        const pricePattern = /\$\d{1,3}(,\d{3})*(\.\d{2})?/g;
        const prices = text.match(pricePattern) || [];
        const uniquePrices = [...new Set(prices)].slice(0, 10);
        logOutput(`Detected prices: ${uniquePrices.join(', ')}`);
        
        // Print first 1000 characters
        logOutput(`--- PREVIEW (First 1000 chars) ---`);
        logOutput(text.substring(0, 1000).replace(/\r\n/g, '\n'));
        logOutput(`---------------------------------`);
      } catch (err) {
        logOutput(`Error parsing PDF ${file}: ${err.message}`);
      }
    }
  }
}

async function run() {
  logOutput(`Starting PDF Scan in ${infoDir}...`);
  await scanPdfs(infoDir);
  fs.writeFileSync(outputFile, outputContent, 'utf-8');
  console.log(`\nWritten all summaries to: ${outputFile}`);
}

run();
