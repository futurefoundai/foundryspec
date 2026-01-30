import { Rule, ProjectContext } from '../types/rules.js';

export const rule: Rule = {
    id: 'persona-diversity',
    name: 'Persona Diversity Verification',
    level: 'project',
    description: "Ensures the project defines at least one of each mandatory persona type: Actor, Influencer, Guardian, and Proxy.",
    target: {
        pathPattern: 'personas/*.mermaid'
    },
    type: 'structural',
    enforcement: 'warning',
    validate: (_asset, context: ProjectContext) => {
        const errors: string[] = [];
        
        const requiredTypes = ['actor', 'influencer', 'guardian', 'proxy'];
        const foundTypes = new Set<string>();

        // Scan all nodes in the project for Persona Types in metadata
        for (const node of context.nodeMap.values()) {
            if (node.metadata?.personaType) {
                foundTypes.add(node.metadata.personaType.toLowerCase());
            }
        }

        const missing = requiredTypes.filter(t => !foundTypes.has(t));
        
        if (missing.length > 0) {
            const capitalized = missing.map(m => m.charAt(0).toUpperCase() + m.slice(1));
            errors.push(
                `Methodology Breach: Missing mandatory Persona types: [${capitalized.join(', ')}].\n` +
                `👉 FoundrySpec requires all 4 types to ensure Zero-Question Implementation readiness.`
            );
        }
        
        return errors;
    }
};
