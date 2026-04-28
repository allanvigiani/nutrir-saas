import fs from 'fs';
import path from 'path';

const walk = (dir, callback) => {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
};

const processFile = (filePath) => {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  if (filePath.includes('src/components/ui/')) return; // skip shadcn ui

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Fix text-muted to text-muted-foreground, avoiding double foreground
  content = content.replace(/\btext-muted\b(?!-foreground)/g, 'text-muted-foreground');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
};

walk('./src/pages', processFile);
walk('./src/components', processFile);
