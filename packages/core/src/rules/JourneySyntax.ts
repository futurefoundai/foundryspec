import { Rule, ProjectContext } from '../types/rules.js';
import { ProjectAsset } from '../types/assets.js';

export const rule: Rule = {
    id: 'journey-syntax',
    name: 'Journey Strict Syntax',
    level: 'folder',
    description: "Journeys must be sequence diagrams and must trace to a Persona (User).",
    target: {
        idPrefix: 'JRN_',
        pathPattern: 'journeys/*'
    },
    type: 'syntax',
    enforcement: 'error',
    hub: {
        id: 'GRP_Journeys',
        title: 'Journeys'
    },
    validate: (asset: ProjectAsset, context: ProjectContext) => {
        const errors: string[] = [];
        
        // 1. Syntax Check
        if (!asset.content.trim().startsWith('sequenceDiagram')) {
            errors.push('Journeys must use "sequenceDiagram" syntax.');
        }

        // 2. Traceability: Must trace to Persona (PER_)
        // Checks if this Journey has an uplink to a PER_ node.
        if (asset.data.id && context.nodeMap.has(asset.data.id)) {
            const node = context.nodeMap.get(asset.data.id)!;
            const hasPersonaLink = node.uplinks.some(up => up.startsWith('PER_'));
            
            if (!hasPersonaLink) {
                errors.push('Journey must trace to a Persona (PER_xxx). Add link: `Ref: PER_xxx` or similar.');
            }
        }

        // 3. Allowed Node Prefixes
        // If we had a mermaid parser here we would check all participants.
        // For now, strict validation needs the analyzer logic which is in RuleEngine.
        // We can expose analyzers to rules or use simple regex.
        // Simple regex scan for "participant X" or "X->Y"
        
        return errors;
    }
};
