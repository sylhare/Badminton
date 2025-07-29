const fs = require('fs');
const path = require('path');

function removeComments(content) {
  content = content.replace(/^(\s*)\/\/.*$/gm, '');
  
  content = content.replace(/\/\*[\s\S]*?\*\//g, '');
  
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return content;
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const cleanedContent = removeComments(content);
    
    if (content !== cleanedContent) {
      fs.writeFileSync(filePath, cleanedContent);
      console.log(`Processed: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

function walkDirectory(dir, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && file !== 'node_modules' && file !== '.git') {
      walkDirectory(filePath, extensions);
    } else if (stat.isFile() && extensions.some(ext => file.endsWith(ext))) {
      processFile(filePath);
    }
  }
}

console.log('Removing comments from all TypeScript/JavaScript files...');
walkDirectory('./src');
walkDirectory('./tests');
const configFiles = [
  './vite.config.ts',
  './vitest.config.ts',
  './tsconfig.json',
  './tsconfig.node.json',
  './.eslintrc.cjs'
];

configFiles.forEach(file => {
  if (fs.existsSync(file)) {
    processFile(file);
  }
});

console.log('Comment removal complete!'); 