const fs = require('fs');
const path = require('path');

const files = [
  'src/components/abogada/ExpedienteManager.tsx',
  'src/components/directora/DirectorDashboard.tsx'
];

const replacements = [
  // Indigo to Blue
  { old: /indigo/g, new: 'blue' },
  { old: /sky/g, new: 'blue' },
  { old: /emerald/g, new: 'blue' },
  { old: /cyan/g, new: 'blue' },
  { old: /violet/g, new: 'blue' },
  { old: /purple/g, new: 'blue' },
  { old: /fuchsia/g, new: 'blue' },

  // Pink/Rose/Amber to Red (mostly)
  // Note: Amber is sometimes better as blue if it's "warning" but user said only blue/red.
  // I'll map amber to red for consistency with "warning" being red.
  { old: /pink/g, new: 'red' },
  { old: /rose/g, new: 'red' },
  { old: /amber/g, new: 'red' },
  { old: /orange/g, new: 'red' },
  { old: /yellow/g, new: 'red' },

  // Specific gradient and hover fixes
  { old: /from-red-500 to-red-600/g, new: 'bg-red-600' },
  { old: /from-blue-500 to-blue-600/g, new: 'bg-blue-600' },
  { old: /bg-gradient-to-br from-blue-600 to-blue-700/g, new: 'bg-blue-600' },
  { old: /bg-gradient-to-br from-red-600 to-red-700/g, new: 'bg-red-600' }
];

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    replacements.forEach(r => {
      content = content.replace(r.old, r.new);
    });
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  } else {
    console.log(`File not found: ${file}`);
  }
});
