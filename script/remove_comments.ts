/**
 * This script removes regular line (//) and block (/* *\/) comments from code files.
 * It preserves triple-slash directives (///) and JSDoc (/** *\/).
 *
 * How to run:
 * From project root: npx tsx script/remove_comments.ts [directories...]
 * Default targets: ./tests
 */

import fs from 'fs';
import path from 'path';

export function removeComments(content: string): string {
    const strings: string[] = [];
    content = content.replace(/`(?:[^`\\]|\\[\s\S])*`|"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*'/g, (match) => {
        return `\x00S${strings.push(match) - 1}\x00`;
    });

    content = content.replace(/(\/\*\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}?)|(\/\*(?!\*)[\s\S]*?\*\/)/g, (_match, preserve) => {
        return preserve ? preserve : '';
    });

    content = content.replace(/(\/\*\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}?|\/\/\/|[a-z]+:\/\/)|(\/\/[^/].*|\/\/$)/g, (_match, preserve) => {
        return preserve ? preserve : '';
    });

    content = content.replace(/^[ \t]+\n/gm, '');
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    content = content.replace(/\x00S(\d+)\x00/g, (_, i) => strings[parseInt(i)]);
    return content;
}

function processFile(filePath: string): void {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const cleanedContent = removeComments(content);

        if (content !== cleanedContent) {
            fs.writeFileSync(filePath, cleanedContent);
            console.log(`Processed: ${filePath}`);
        }
    } catch (error) {
        console.error(`Error processing ${filePath}:`, (error as Error).message);
    }
}

function walkDirectory(dir: string, extensions = ['.ts', '.tsx', 'cjs', '.js', '.jsx']): void {
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

const directories = process.argv.slice(2);
if (directories.length === 0) {
    directories.push('./tests');
}

console.log(`Removing comments from: ${directories.join(', ')}`);
directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
        console.warn(`Path does not exist: ${dir}`);
        return;
    }
    const stat = fs.statSync(dir);
    if (stat.isDirectory()) {
        walkDirectory(dir);
    } else if (stat.isFile()) {
        processFile(dir);
    }
});

console.log('Comment removal complete!');
