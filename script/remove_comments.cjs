/**
 * This script removes regular line (//) and block (/* *\/) comments from code files.
 * It preserves triple-slash directives (///) and JSDoc (/** *\/).
 * 
 * How to run:
 * From project root: node script/remove_comments.cjs [directories...]
 * Default targets: ./tests
 */

const fs = require('fs');
const path = require('path');

/**
 * Removes comments from the provided content string.
 * @param {string} content - The code content to clean.
 * @returns {string} The cleaned content.
 */
function removeComments(content) {
    content = content.replace(/(\/\*\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}?)|(\/\*(?!\*)[\s\S]*?\*\/)/g, (match, preserve) => {
        return preserve ? preserve : "";
    });

    content = content.replace(/(\/\*\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}?|\/\/\/|[a-z]+:\/\/)|(\/\/[^/].*|\/\/$)/g, (match, preserve) => {
        return preserve ? preserve : "";
    });

    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    return content;
}

/**
 * Processes a single file to remove comments.
 */
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

/**
 * Recursively walks a directory to find and process files.
 */
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

/** Main execution block */
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