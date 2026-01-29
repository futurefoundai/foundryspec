
/**
 * Foundryspec Source Sync Protocol
 * --------------------------------
 * Bypasses JSDOM/Puppeteer by compiling official Mermaid JISON grammars 
 * into standalone Node.js parsers.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration: Map Diagram Types to their Upstream Grammar URLs
// Note: URLs verified against mermaid-js/mermaid@develop
const GRAMMARS = {
    flowchart: {
        url: 'https://raw.githubusercontent.com/mermaid-js/mermaid/develop/packages/mermaid/src/diagrams/flowchart/parser/flow.jison',
        filename: 'flow.jison',
        parserName: 'flowchartParser.cjs'
    },
    sequence: {
        url: 'https://raw.githubusercontent.com/mermaid-js/mermaid/develop/packages/mermaid/src/diagrams/sequence/parser/sequenceDiagram.jison',
        filename: 'sequenceDiagram.jison',
        parserName: 'sequenceParser.cjs'
    },
    er: { // Entity Relationship
        url: 'https://raw.githubusercontent.com/mermaid-js/mermaid/develop/packages/mermaid/src/diagrams/er/parser/erDiagram.jison',
        filename: 'erDiagram.jison',
        parserName: 'erParser.cjs'
    },
    class: {
        url: 'https://raw.githubusercontent.com/mermaid-js/mermaid/develop/packages/mermaid/src/diagrams/class/parser/classDiagram.jison',
        filename: 'classDiagram.jison',
        parserName: 'classParser.cjs'
    },
    state: {
        url: 'https://raw.githubusercontent.com/mermaid-js/mermaid/develop/packages/mermaid/src/diagrams/state/parser/stateDiagram.jison',
        filename: 'stateDiagram.jison',
        parserName: 'stateParser.cjs'
    },
    mindmap: {
        url: 'https://raw.githubusercontent.com/mermaid-js/mermaid/develop/packages/mermaid/src/diagrams/mindmap/parser/mindmap.jison',
        filename: 'mindmap.jison',
        parserName: 'mindmapParser.cjs'
    },
    requirement: {
        url: 'https://raw.githubusercontent.com/mermaid-js/mermaid/develop/packages/mermaid/src/diagrams/requirement/parser/requirementDiagram.jison',
        filename: 'requirementDiagram.jison',
        parserName: 'requirementParser.cjs'
    }
};

const DIRS = {
    grammars: path.join(__dirname, '../../foundry_grammars'),
    parsers: path.join(__dirname, '../src/parsers/generated')
};

// Ensure directories exist
Object.values(DIRS).forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

async function sync() {
    console.log('🔗 Initiating Foundryspec Source Sync Protocol...');
    
    for (const [key, config] of Object.entries(GRAMMARS)) {
        try {
            console.log(`\n📦 working on [${key}]...`);
            
            // 1. Fetch Grammar
            const grammarPath = path.join(DIRS.grammars, config.filename);
            console.log(`   ⬇️  Fetching from upstream...`);
            // using curl via execSync for simplicity
            execSync(`curl -f -L -s ${config.url} -o "${grammarPath}"`);
            
            // 2. Generate Parser
            const parserPath = path.join(DIRS.parsers, config.parserName);
            console.log(`   🔨 Compiling standalone parser...`);
            // jison <grammar> -o <output>
            execSync(`npx jison "${grammarPath}" -o "${parserPath}"`);
            
            console.log(`   ✅ Synced: ${config.parserName}`);

        } catch (e) {
            console.warn(`   ⚠️  Failed to sync [${key}]: ${e.message.split('\n')[0]}`);
            if (e.message.includes('curl')) {
                console.warn(`      (Is the URL correct? 404 indicates migration to Langium or path change)`);
            }
        }
    }
    
    console.log('\n✨ Sync Protocol Complete.');
}

sync();
