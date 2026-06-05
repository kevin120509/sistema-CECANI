const fs = require('fs');
const path = require('path');

function findFiles(dir, exts, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.next' || file === '.git') continue;
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findFiles(filePath, exts, fileList);
    } else {
      if (exts.includes(path.extname(filePath))) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

const exts = ['.xlsx', '.xls', '.csv'];
const foundFiles = findFiles(process.cwd(), exts);
console.log(foundFiles);
