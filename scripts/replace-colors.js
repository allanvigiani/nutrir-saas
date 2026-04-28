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
  { regex: /\bbg-white\b/g, replacement: 'bg-card' },
  { regex: /\bbg-slate-50\b/g, replacement: 'bg-muted\/30' }, 
  { regex: /\bbg-slate-100\b/g, replacement: 'bg-muted' },
  { regex: /\bbg-slate-200\b/g, replacement: 'bg-accent' },
  { regex: /\bborder-slate-100\b/g, replacement: 'border-border' },
  { regex: /\bborder-slate-200\b/g, replacement: 'border-border' },
  { regex: /\btext-slate-900\b/g, replacement: 'text-foreground' },
  { regex: /\btext-slate-800\b/g, replacement: 'text-foreground' },
  { regex: /\btext-slate-700\b/g, replacement: 'text-muted-foreground' },
  { regex: /\btext-slate-600\b/g, replacement: 'text-muted-foreground' },
  { regex: /\btext-slate-500\b/g, replacement: 'text-muted-foreground' },
  { regex: /\btext-slate-400\b/g, replacement: 'text-muted-foreground' },
  { regex: /\bhover:bg-slate-50\b/g, replacement: 'hover:bg-muted\/50' },
  { regex: /\bhover:bg-slate-100\b/g, replacement: 'hover:bg-accent' },
  { regex: /\btext-slate-300\b/g, replacement: 'text-muted' },
  { regex: /\bring-slate-100\b/g, replacement: 'ring-border' },
  { regex: /\bring-slate-200\b/g, replacement: 'ring-border' },
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
