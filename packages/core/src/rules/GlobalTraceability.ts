import { Rule, ProjectContext } from '../types/rules.js';
import { ProjectAsset } from '../types/assets.js';

export const rule: Rule = {
    id: 'global-traceability',
    name: 'Global Document Traceability',
    level: 'project',
    description: "To maintain 100% intent-to-code integrity, every document (node) must be reachable from the Hub Root.",
    target: {
        // Targets both mermaid and md files, similar to original pattern "**/*.{mermaid,md}"
        // RuleEngine handles glob parsing, but simple regex translation might need strict glob.
        pathPattern: '**/*.{mermaid,md}'
    },
    type: 'traceability',
    enforcement: 'error',
    validate: (asset: ProjectAsset, context: ProjectContext) => {
        const errors: string[] = [];
        // This check usually relies on "mustBeLinked" logic in RuleEngine.
        // We can replicate simple "Orphan Check" here.
        
        const entities = Array.isArray(asset.data.entities) ? asset.data.entities : [];
        // Add implicit file ID entity if present
        if (asset.data.id) entities.push({ id: asset.data.id });

        for (const ent of entities) {
             if (typeof ent.id === 'string' && !context.referencedIds.has(ent.id)) {
                  errors.push(
                    `❌ Orphan Detected: Entity "${ent.id}" is disconnected from the graph.\n` +
                    `   👉 Fix: Ensure this ID is mentioned in a Mermaid diagram or place the file in the correct architectural folder.`
                  );
             }
        }
        
        return errors;
    }
};
