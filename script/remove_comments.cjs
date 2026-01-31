/**
 * Comment Removal Script
 *
 * Removes line (//) and block comments from code files.
 * By default targets `tests/`, but accepts directories as CLI arguments.
 *
 * @example
 * // From project root:
 * node script/remove_comments.cjs
 * node script/remove_comments.cjs src tests --keep-jsdoc --keep-triple-slash
 */

const fs = require('fs');
const path = require('path');

/**
 * Removes comments from file content.
 * @param {string} content - The file content to process
 * @param {Object} options - Configuration options
 * @param {boolean} [options.keepJsDoc=false] - Preserve JSDoc comments
 * @param {boolean} [options.keepTripleSlash=false] - Preserve triple-slash directives
 * @returns {string} Content with comments removed
 */
function removeComments(content, options = {}) {
    const { keepJsDoc = false, keepTripleSlash = false } = options;

    if (keepJsDoc) {
        content = content.replace(/\/\*(?!\*)[\s\S]*?\*\//g, '');
    } else {
        content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    }

    if (keepTripleSlash) {
        content = content.replace(/^(\s*)\/\/(?!\/).*$/gm, '');
    } else {
        content = content.replace(/^(\s*)\/\/.*$/gm, '');
    }

    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    return content;
}

/**
 * Processes a single file, removing comments and writing back if changed.
 * @param {string} filePath - Path to the file
 * @param {Object} options - Configuration options for removeComments
 */
function processFile(filePath, options = {}) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const cleanedContent = removeComments(content, options);

        if (content !== cleanedContent) {
            fs.writeFileSync(filePath, cleanedContent);
            console.log(`Processed: ${filePath}`);
        }
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
    }
}

/**
 * Recursively walks a directory and processes matching files.
 * @param {string} dir - Directory path to walk
 * @param {Object} options - Configuration options for removeComments
 * @param {string[]} [extensions=['.ts', '.tsx', '.js', '.jsx']] - File extensions to process
 */
function walkDirectory(dir, options = {}, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory() && file !== 'node_modules' && file !== '.git') {
            walkDirectory(filePath, options, extensions);
        } else if (stat.isFile() && extensions.some(ext => file.endsWith(ext))) {
            processFile(filePath, options);
        }
    }
}

const args = process.argv.slice(2);
const options = {
    keepJsDoc: args.includes('--keep-jsdoc'),
    keepTripleSlash: args.includes('--keep-triple-slash'),
};

const directories = args.filter(arg => !arg.startsWith('--'));
if (directories.length === 0) {
    directories.push('./tests');
}

const preserving = [];
if (options.keepJsDoc) preserving.push('JSDoc');
if (options.keepTripleSlash) preserving.push('triple-slash (///)');

console.log(`Removing comments from: ${directories.join(', ')}`);
if (preserving.length > 0) {
    console.log(`Preserving: ${preserving.join(', ')}`);
}
directories.forEach(dir => walkDirectory(dir, options));

console.log('Comment removal complete!'); 