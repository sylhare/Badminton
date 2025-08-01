// How to run this script:
// From project root: node script/remove_comments.cjs
// Or from script directory: node remove_comments.cjs
//
// This script removes all line (//) and block (/* */) comments from code files.
// By default it targets the `tests/` directory, but you can pass other directories as CLI arguments.

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

// Determine which directories to process:
// Pass directories as CLI args, e.g. `node remove_comments.cjs src tests`.
// If none supplied, we default to just the tests directory.
const directories = process.argv.slice(2);
if (directories.length === 0) {
    directories.push('./tests');
}

console.log(`Removing comments from: ${directories.join(', ')}`);
directories.forEach(dir => walkDirectory(dir));

console.log('Comment removal complete!'); 