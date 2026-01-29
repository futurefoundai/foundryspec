
import { MermaidParser } from './dist/MermaidParser.js';
import { RuleEngine } from './dist/RuleEngine.js';
import { CacheManager } from './dist/CacheManager.js';

async function verify() {
    const ruleEngine = new RuleEngine();
    const cacheManager = new CacheManager('/tmp/foundry_test_cache');
    const parser = new MermaidParser(ruleEngine, cacheManager);

    const diagrams = {
        flowchart: `graph TD
            A[Start] --> B(Process)
            B --> C{Decision}
            C -->|Yes| D[End]`,
        sequence: `sequenceDiagram
            Alice->>Bob: Hello
            Bob-->>Alice: Hi`,
        class: `classDiagram
            Animal <|-- Duck
            class Animal {
                +int age
                +move()
            }`,
        state: `stateDiagram-v2
            [*] --> Idle
            Idle --> Moving : start
            Moving --> [*]`,
        er: `erDiagram
            USER ||--o{ ORDER : places
            USER {
                string name
            }`,
        mindmap: `mindmap
            root
                child1
                child2`,
        requirement: `requirementDiagram
            requirement test_req {
                id: 1
                text: "The system shall test."
                risk: low
                verifymethod: test
            }
            element test_el {
                type: component
            }
            test_el - satisfies -> test_req`
    };

    console.log('--- Foundryspec Sync Protocol Verification ---');

    for (const [type, content] of Object.entries(diagrams)) {
        console.log(`\nTesting [${type}]...`);
        try {
            const result = await parser.parseWithCache(`test_${type}.mermaid`, content);
            console.log(`   ✅ Nodes found: ${result.nodes.length} (${result.nodes.slice(0, 3).join(', ')}${result.nodes.length > 3 ? '...' : ''})`);
            console.log(`   ✅ Relationships found: ${result.relationships.length}`);
            if (result.validationErrors && result.validationErrors.length > 0) {
                console.warn(`   ⚠️  Validation Errors:`, result.validationErrors);
            }
        } catch (e) {
            console.error(`   ❌ Failed: ${e.message}`);
        }
    }

    console.log('\n--- Verification Complete ---');
}

verify();
