import { Rule, ProjectContext } from '../types/rules.js';
import { ProjectAsset } from '../types/assets.js';

export const rule: Rule = {
    id: 'journey-integrity',
    name: 'Journey Integrity & Coverage',
    level: 'project',
    target: { pathPattern: 'N/A' },
    type: 'traceability',
    enforcement: 'warning',
    description: "Ensures all Stakeholders (Personas) and Functional Requirements are validated by at least one Journey.",
    validate: (_asset: ProjectAsset, context: ProjectContext) => {
        const errors: string[] = [];
        
        const personasWithJourneys = new Set<string>();
        const functionalReqsWithJourneys = new Set<string>();
        const allPersonas = new Set<string>();
        const allFunctionalReqs = new Set<string>();

        // 1. Audit all nodes to find Personas, Functional Reqs, and Journeys
        for (const [id, node] of context.nodeMap.entries()) {
            if (id.startsWith('PER_')) {
                allPersonas.add(id);
            }

            if (id.startsWith('REQ_')) {
                const isFunctional = node.metadata?.classification?.toLowerCase() === 'functional' || 
                                   (node.metadata?.isFileRoot && !node.metadata?.classification);
                if (isFunctional) {
                    allFunctionalReqs.add(id);
                }
            }

            if (id.startsWith('JRN_')) {
                // Tracking what this Journey validates
                node.uplinks.forEach(up => {
                    if (up.startsWith('PER_')) personasWithJourneys.add(up);
                    if (up.startsWith('REQ_')) {
                        const reqNode = context.nodeMap.get(up);
                        const isFunctional = reqNode?.metadata?.classification?.toLowerCase() === 'functional' || 
                                           (reqNode?.metadata?.isFileRoot && !reqNode?.metadata?.classification);
                        if (isFunctional) functionalReqsWithJourneys.add(up);
                    }
                });
            }
        }

        // 2. Identify Gaps
        allPersonas.forEach(p => {
            const pNode = context.nodeMap.get(p);
            const pType = pNode?.metadata?.personaType || 'actor'; // Default to actor if unknown

            // Behavioral stakeholders (Actors and Proxies) MUST have journeys
            // Passive stakeholders (Influencers and Guardians) are exempt from warnings
            const isBehavioral = ['actor', 'proxy'].includes(pType.toLowerCase());

            if (isBehavioral && !personasWithJourneys.has(p)) {
                errors.push(`Orphaned Behavioral Stakeholder: ${pType.charAt(0).toUpperCase() + pType.slice(1)} "${p}" has no associated Journeys. Every active stakeholder's path should be documented.`);
            }
        });

        allFunctionalReqs.forEach(r => {
            if (!functionalReqsWithJourneys.has(r)) {
                errors.push(`Unvalidated Intent: Functional Requirement "${r}" has no associated Journeys. Functional requirements must be verified by at least one end-to-end flow.`);
            }
        });

        return errors;
    }
};
