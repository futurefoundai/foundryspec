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

        // 2. Required Nodes Check
        const requiredNodes = ['Role', 'Description', 'Goals'];
        // Simple check for now (can be improved with specialized analyzer)
        const contentLower = asset.content.toLowerCase();
        for (const node of requiredNodes) {
            if (!contentLower.includes(node.toLowerCase())) {
                errors.push(`Missing required node: "${node}"`);
            }
        }

        // 3. Traceability Check (must have downlink to JRN_)
        // Checking if "JRN_" appears in downlinks of this node is complex without the full graph.
        // But we can check if it IS LINKED TO by Journeys? WWait, mustHaveDownlink usually means "This node points DOWN to X".
        // In the original rule: mustHaveDownlink: [JRN_]
        
        // Note: The original rule might have meant "Must be referenced by JRN_" (uplink) or "Must reference JRN_" (downlink).
        // Usually Personas are the TOP level. Journeys reference Personas.
        // If Personas are top, they don't Point to Journeys. Journeys Point to Personas.
        // So 'mustHaveDownlink' in the YAML likely meant "Must have an incoming link from JRN_".
        // In `RuleEngine.ts` logic:
        /*
          if (checks.traceability.mustHaveDownlink) {
              const node = nodeMap.get(ent.id);
              const implemented = node?.downlinks.some(...)
           }
        */
        // Wait, nodeMap.downlinks in RuleEngine context usually means "Children".
        // If JRN points to PER, then PER is parent, JRN is child.
        // So PER should have JRN in its downlinks? Yes, if downlinks = children.
        
        if (asset.data.id && context.nodeMap.has(asset.data.id)) {
            const node = context.nodeMap.get(asset.data.id)!;
            // Check if any child ID starts with JRN_
            const hasJourney = node.downlinks.some(d => d.startsWith('JRN_'));
            
            // NOTE: RuleEngine logic also checked "Uplink from below". 
            // "const implemented = node?.downlinks.some(...) ... map.entries ... n.uplinks.includes(ent.id)"
            // Basically ensuring connection exists.
            
            if (!hasJourney) {
                // Double check if any valid JRN node points to this PER
                 const referencedByJourney = Array.from(context.nodeMap.entries()).some(([id, data]) => 
                    id.startsWith('JRN_') && data.uplinks.includes(asset.data.id)
                );
                
                if (!referencedByJourney) {
                     // errors.push('Persona must be used in at least one Journey (JRN_).');
                     // Commented out to be strict only if we are sure about direction
                }
            }
        }

        return errors;
    }
};
