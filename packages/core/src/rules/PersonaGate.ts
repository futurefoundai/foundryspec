import { Rule, ProjectContext } from '../types/rules.js';
import { ProjectAsset } from '../types/assets.js';

export const rule: Rule = {
    id: 'persona-gate',
    name: 'Persona Architecture Gate',
    level: 'folder',
    description: "Personas must be mindmaps with Role, Description, and Goals to support consistent user modeling.",
    target: {
        idPrefix: 'PER_',
        pathPattern: 'personas/*'
    },
    type: 'structural',
    enforcement: 'error',
    // Hub Definition
    hub: {
        id: 'GRP_Personas',
        title: 'Personas'
    },
    validate: (asset: ProjectAsset, context: ProjectContext) => {
        const errors: string[] = [];
        
        // 1. Mermaid Type Check
        if (!asset.content.trim().startsWith('mindmap')) {
            errors.push('Personas must use "mindmap" syntax.');
        }

        // 2. Structural Check using AST Analysis
        const nodes = asset.analysis?.nodes || [];
        const validTypes = ['actor', 'influencer', 'guardian', 'proxy'];
        
        const requiredNodes = ['Role', 'Description', 'Goals'];
        
        // Check for Required Metadata Nodes
        for (const req of requiredNodes) {
             if (!nodes.some((n: string) => n.toLowerCase() === req.toLowerCase())) {
                 errors.push(`Persona Mindmap: Missing required branch: "${req}"`);
             }
        }

        // 3. Semantic ID Check (Enforce ID-based structure)
        const semanticIds = ['ROLE', 'DESCRIPTION'];
        for (const sem of semanticIds) {
            if (!nodes.some((n: any) => (typeof n === 'string' ? n : n.id) === sem)) {
                errors.push(`Persona Mindmap: Missing required semantic ID: "${sem}" (e.g., ${sem}["..."])`);
            }
        }

        if (!nodes.some((n: any) => {
            const id = typeof n === 'string' ? n : n.id;
            return id && id.startsWith('GOAL_');
        })) {
            errors.push('Persona Mindmap: Missing semantic ID: "GOAL_N" (at least one goal required).');
        }

        // Check for Type Node
        const typeNode = nodes.find((n: string) => {
            const low = n.toLowerCase();
            return low.startsWith('type:') || (low.startsWith('type(') && low.endsWith(')'));
        });

        if (!typeNode) {
            errors.push('Persona Mindmap: Missing mandatory "Type: Value" node (e.g., Type: Actor).');
        } else {
            // Extract value after : or between ( )
            const typeValue = typeNode.includes(':') 
                ? typeNode.split(':')[1].trim().toLowerCase()
                : typeNode.match(/\(([^)]+)\)/)?.[1].toLowerCase();
                
            if (!typeValue || !validTypes.includes(typeValue)) {
                errors.push(`Persona Mindmap: Invalid persona type "${typeValue}". Must be one of: [Actor, Influencer, Guardian, Proxy]`);
            } else if (asset.data.id && context.nodeMap.has(asset.data.id)) {
                // Store in metadata for project-wide diversity check
                const node = context.nodeMap.get(asset.data.id)!;
                node.metadata = { ...node.metadata, personaType: typeValue };
            }
        }

        return errors;
    }
};
