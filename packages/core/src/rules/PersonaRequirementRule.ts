import { Rule, ProjectContext } from '../types/rules.js';
import { ProjectAsset } from '../types/assets.js';

export const rule: Rule = {
    id: 'persona-requirement-trace',
    name: 'Persona Requirement Connectivity',
    level: 'project',
    target: { pathPattern: 'N/A' },
    type: 'traceability',
    enforcement: 'error',
    description: "Every Persona MUST drive at least one Requirement to avoid being a 'ghost' in the system.",
    validate: (_asset: ProjectAsset, context: ProjectContext) => {
        const errors: string[] = [];
        
        // Audit ALL nodes in the project graph
        for (const [id, node] of context.nodeMap.entries()) {
            // 1. Persona Rules
            if (id.startsWith('PER_')) {
                const relatedReqs = node.downlinks.filter(d => d.startsWith('REQ_'));
                
                if (relatedReqs.length === 0) {
                    errors.push(
                        `Ghost in the System: Persona "${id}" HAS NO ASSOCIATED REQUIREMENTS.\n` +
                        `   👉 Every persona must drive at least one high-level REQ_ node.`
                    );
                    continue;
                }

                for (const reqId of relatedReqs) {
                    const reqNode = context.nodeMap.get(reqId);
                    if (reqNode) {
                        const hasParentReq = reqNode.uplinks.some(u => u.startsWith('REQ_'));
                        if (hasParentReq) {
                            errors.push(
                                `Architectural Mismatch: Persona "${id}" is linked to sub-requirement "${reqId}".\n` +
                                `   👉 Personas must only link to high-level "Main" requirements. Trace "${reqId}" to its parent and link to that instead.`
                            );
                        }
                    }
                }
            }

            // 2. Requirement Rules: All Main Requirements must be linked to a Persona
            if (id.startsWith('REQ_')) {
                const hasParentReq = node.uplinks.some(u => u.startsWith('REQ_'));
                if (!hasParentReq) {
                    // This is a Main Requirement
                    const linkedPersonas = node.uplinks.filter(u => u.startsWith('PER_'));
                    if (linkedPersonas.length === 0) {
                        errors.push(
                            `Abandoned Requirement: Main Requirement "${id}" HAS NO LINKED PERSONAS.\n` +
                            `   👉 Every high-level requirement must be driven by at least one stakeholder (Persona).`
                        );
                    }
                }
            }
        }

        return errors;
    }
};
