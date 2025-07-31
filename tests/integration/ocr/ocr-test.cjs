#!/usr/bin/env node

// How to run this script:
// From project root: node tests/integration/ocr-test.cjs
//
// This script tests the real OCR functionality using the actual names.png image
// and the real Tesseract.js library (not mocked).

const {createWorker} = require('tesseract.js');
const fs = require('fs');
const path = require('path');

// Simple name extraction function (inline version)
function extractPlayerNamesSimple(text) {
    if (!text || typeof text !== 'string') {
        return [];
    }

    // Split by lines and clean up
    const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const playerNames = [];

    for (const line of lines) {
        // Skip lines that are too short or contain mostly non-letters
        if (line.length < 2) continue;

        // Skip lines with lots of numbers or special characters
        const letterCount = (line.match(/[a-zA-Z]/g) || []).length;
        if (letterCount < line.length * 0.7) continue;

        // Split by common separators and process each part
        const parts = line.split(/[,;|\t]+/);

        for (let part of parts) {
            part = part.trim();

            // Basic name validation
            if (part.length >= 2 && part.length <= 25) {
                // Remove extra whitespace and normalize
                const cleanName = part.replace(/\s+/g, ' ').trim();

                if (cleanName && !playerNames.includes(cleanName)) {
                    playerNames.push(cleanName);
                }
            }
        }
    }

    return playerNames;
}

async function testRealOCR() {
    console.log('🔍 Testing Real OCR with names.png...\n');

    try {
        // Load the actual image file
        const imagePath = path.join(__dirname, '../data/names.png');
        console.log(`📂 Loading image: ${imagePath}`);

        const imageBuffer = fs.readFileSync(imagePath);
        console.log(`✅ Image loaded successfully (${imageBuffer.length} bytes)\n`);

        // Create a real Tesseract worker
        console.log('🔧 Initializing Tesseract worker...');
        const worker = await createWorker({
            logger: m => {
                if (m.status === 'recognizing text') {
                    process.stdout.write(`\r📖 OCR Progress: ${Math.round(m.progress * 100)}%`);
                } else {
                    console.log(`   ${m.status}: ${m.progress ? Math.round(m.progress * 100) + '%' : ''}`);
                }
            },
        });

        try {
            // Initialize the worker
            await worker.loadLanguage('eng');
            await worker.initialize('eng');
            console.log('✅ Tesseract worker initialized\n');

            // Process the real image
            console.log('🔍 Processing image with OCR...');
            const {data: {text}} = await worker.recognize(imageBuffer);
            console.log('\n✅ OCR processing complete!\n');

            console.log('📝 Raw OCR Text:');
            console.log('='.repeat(50));
            console.log(text);
            console.log('='.repeat(50) + '\n');

            // Extract player names using the simple function
            console.log('🎯 Extracting player names...');
            const extractedNames = extractPlayerNamesSimple(text);

            console.log('📋 Extracted Player Names:');
            console.log(JSON.stringify(extractedNames, null, 2));
            console.log('');

            // Expected names from the image
            const expectedNames = ['Tinley', 'Ella', 'Avrella', 'Yvette', 'Gabriela', 'Noella'];

            // Check matching
            const foundNames = expectedNames.filter(name =>
                extractedNames.some(extracted =>
                    extracted.toLowerCase().includes(name.toLowerCase()) ||
                    name.toLowerCase().includes(extracted.toLowerCase())
                )
            );

            console.log('🎯 Results:');
            console.log(`   Expected names: ${expectedNames.length}`);
            console.log(`   Extracted names: ${extractedNames.length}`);
            console.log(`   Matched names: ${foundNames.length}`);
            console.log(`   Match rate: ${Math.round((foundNames.length / expectedNames.length) * 100)}%`);
            console.log('');

            console.log('✅ Expected:', expectedNames);
            console.log('🔍 Found matches:', foundNames);

            if (foundNames.length >= 4) {
                console.log('\n🎉 SUCCESS: OCR successfully extracted most names!');
            } else {
                console.log('\n⚠️  WARNING: OCR may need adjustment - only found', foundNames.length, 'out of', expectedNames.length, 'expected names');
            }

        } finally {
            // Clean up
            await worker.terminate();
            console.log('\n🧹 Tesseract worker terminated');
        }

    } catch (error) {
        console.error('❌ Error during OCR test:', error.message);
        process.exit(1);
    }
}

// Run the test
testRealOCR().then(() => {
    console.log('\n✅ Real OCR test completed!');
}).catch(error => {
    console.error('\n❌ Real OCR test failed:', error);
    process.exit(1);
}); 