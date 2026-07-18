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
import { pathToFileURL } from 'url';

/**
 * Strips line (//) and block comments while preserving JSDoc (/** *\/),
 * triple-slash directives (///), JSX comments ({/* *\/}), URLs, and the
 * contents of string / template literals. A trailing inline comment is dropped
 * without leaving trailing whitespace behind.
 *
 * Implemented as a single-pass scanner, not a regex: a regex can't tell a quote
 * that opens a real string from an apostrophe inside a comment (e.g. `can't`),
 * so it would swallow all the code between the two.
 */
export function removeComments(content: string): string {
    let out = '';
    const n = content.length;
    let i = 0;

    while (i < n) {
        const c = content[i];

        if (c === '"' || c === '\'' || c === '`') {
            out += c;
            i++;
            while (i < n) {
                const ch = content[i];
                out += ch;
                i++;
                if (ch === '\\' && i < n) {
                    out += content[i];
                    i++;
                    continue;
                }
                if (ch === c) break;
            }
            continue;
        }

        if (c === '/' && content[i + 1] === '*') {
            const isJsDoc = content[i + 2] === '*';
            const isJsx = out.length > 0 && out[out.length - 1] === '{';
            let j = i + 2;
            while (j < n && !(content[j] === '*' && content[j + 1] === '/')) j++;
            const end = Math.min(j + 2, n);
            if (isJsDoc || isJsx) out += content.slice(i, end);
            i = end;
            continue;
        }

        if (c === '/' && content[i + 1] === '/') {
            if (content[i + 2] === '/') {
                while (i < n && content[i] !== '\n') { out += content[i]; i++; }
                continue;
            }
            const prev = out[out.length - 1];
            const prevPrev = out[out.length - 2];
            const isUrlScheme = prev === ':' && prevPrev !== undefined && /[a-z]/i.test(prevPrev);
            if (isUrlScheme) {
                out += c;
                i++;
                continue;
            }
            const lineStart = out.lastIndexOf('\n') + 1;
            if (out.slice(lineStart).trim() !== '') {
                out = out.slice(0, lineStart) + out.slice(lineStart).replace(/[ \t]+$/, '');
            }
            while (i < n && content[i] !== '\n') i++;
            continue;
        }

        out += c;
        i++;
    }

    out = out.replace(/^[ \t]+\n/gm, '');
    out = out.replace(/\n\s*\n\s*\n/g, '\n\n');
    return out;
}

/** Strips comments from a single file, rewriting it only when the content changes. */
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

/** Recursively strips comments from every matching source file under `dir`, skipping node_modules and .git. */
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

/** CLI entry point: strips comments from the given file/dir paths (defaulting to ./tests). */
function main(): void {
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
}

/**
 * Run main() only when invoked directly, never when imported for the
 * `removeComments` export — otherwise a unit test importing this module would
 * trigger file writes off process.argv.
 */
const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
    main();
}
