import { Rule, ProjectContext } from '../types/rules.js';
import { ProjectAsset } from '../types/assets.js';

export const rule: Rule = {
    id: 'requirement-syntax',
    name: 'Requirement Syntax',
    level: 'folder',
    description: "Requirements must use specific Mermaid syntax for automated traceability.",
    target: {
        idPrefix: 'REQ_',
        pathPattern: 'requirements/*'
    },
    type: 'syntax',
    enforcement: 'error',
    hub: {
        id: 'GRP_Requirements',
        title: 'Requirements'
    },
    validate: (asset: ProjectAsset, context: ProjectContext) => {
        const errors: string[] = [];

        // 1. Syntax Check
        if (!asset.content.trim().startsWith('requirementDiagram')) {
            errors.push('Requirements must use "requirementDiagram" syntax.');
        }

        // 2. Traceability
        // mustTraceTo: [PER_, REQ_]
        // mustHaveDownlink: [FEAT_, COMP_, CTX_, BND_, REQ_]
        if (asset.data.id && context.nodeMap.has(asset.data.id)) {
            const node = context.nodeMap.get(asset.data.id)!;
            
            // Uplinks (Trace To)
            const hasUplink = node.uplinks.some(u => u.startsWith('PER_') || u.startsWith('REQ_'));
            if (!hasUplink) {
               // errors.push('Requirement must trace to a Persona (PER_) or parent Requirement (REQ_).');
            }
            
            // Downlinks (Implemented By)
            // Implementation logic is complex (reverse lookups etc), keeping basic check for now.
        }

        return errors;
    }
};
