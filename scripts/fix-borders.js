import fs from 'fs';
import path from 'path';

const walk = (dir, callback) => {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
};

const replacements = [
  { regex: /\bborder-slate-50\b/g, replacement: 'border-border' },
  { regex: /\bborder-slate-100\b/g, replacement: 'border-border' },
  { regex: /\bborder-slate-200\b/g, replacement: 'border-border' },
  { regex: /\bborder-slate-300\b/g, replacement: 'border-border' },
  { regex: /\bdivide-slate-50\b/g, replacement: 'divide-border' },
  { regex: /\bdivide-slate-100\b/g, replacement: 'divide-border' },
  { regex: /\bdivide-slate-200\b/g, replacement: 'divide-border' },
  { regex: /\bdivide-slate-300\b/g, replacement: 'divide-border' },
  { regex: /\bbg-slate-300\b/g, replacement: 'bg-border' },
];

const processFile = (filePath) => {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  if (filePath.includes('src/components/ui/')) return; // skip shadcn ui

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  replacements.forEach(r => {
    content = content.replace(r.regex, r.replacement);
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
};

walk('./src/pages', processFile);
walk('./src/components', processFile);
