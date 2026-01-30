import { Rule, ProjectContext } from '../types/rules.js';
import { ProjectAsset } from '../types/assets.js';
import chalk from 'chalk';

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

        const nodes = asset.analysis?.nodes || [];

        // 2. Participant Validation (Entity Verification)
        // All participants must match known architectural ID prefixes
        const allowedPrefixes = ['PER_', 'COMP_', 'SYS_', 'BND_', 'CTX_', 'DATA_'];
        const participants = nodes.filter(n => typeof n === 'string' && /^[A-Z]{2,}_/.test(n));
        
        for (const p of participants) {
            const hasValidPrefix = allowedPrefixes.some(prefix => p.startsWith(prefix));
            if (!hasValidPrefix) {
                errors.push(`Invalid participant ID: "${p}". All journey actors must be documented architectural entities starting with: [${allowedPrefixes.join(', ')}]`);
            } else if (!context.idToFileMap.has(p)) {
                // Warning only for missing files of participants to allow iterative design
                // console.warn(`Reference warning: Participant "${p}" has no corresponding documentation.`);
            }
        }
        
        const hasPersona = participants.some(p => p.startsWith('PER_'));
        if (!hasPersona) {
            errors.push('Journeys must involve at least one Persona (PER_xxx). If this is strictly component-to-component, move it to "sequences/".');
        }

        // 3. Metadata Check (Trigger & Outcome)
        // Check frontmatter first, then fallback to Notes in diagram
        const trigger = asset.data.trigger || nodes.find(n => typeof n === 'string' && n.toLowerCase().startsWith('trigger:'));
        const outcome = asset.data.outcome || nodes.find(n => typeof n === 'string' && n.toLowerCase().startsWith('outcome:'));

        if (!trigger) {
            // Enforcement: Warning for now
            console.warn(chalk.yellow(`⚠️  Journey Innovation Suggestion: Add a "trigger" to ${asset.relPath} for high-fidelity AI-readiness.`));
        }
        if (!outcome) {
            // Enforcement: Warning for now
             console.warn(chalk.yellow(`⚠️  Journey Innovation Suggestion: Add an "outcome" to ${asset.relPath} for high-fidelity AI-readiness.`));
        }

        // 3.1 Deprecation Check: 'uplink' in frontmatter
        if (asset.data.uplink) {
            console.warn(chalk.yellow(`\n⚠️  Deprecation Warning: Manual 'uplink' detected in ${asset.relPath}.
   👉 Innovation: Journeys should be 'owned' by Personas (via mindmaps) or Requirements (via diagrams).
   Please migrate to the Ownership model (Parent -> Child) to ensure architectural integrity.`));
        }

        // 4. Traceability: Must trace to Persona (PER_) OR be owned by a Requirement (REQ_)
        if (asset.data.id && context.nodeMap.has(asset.data.id)) {
            const node = context.nodeMap.get(asset.data.id)!;
            
            // A. Parent Link (Persona or Requirement)
            const hasParentLink = node.uplinks.some(up => up.startsWith('PER_') || up.startsWith('REQ_'));
            if (!hasParentLink) {
                errors.push('Traceability Gap: Journey must be referenced by a Persona (PER_xxx) in their mindmap or by a Requirement (REQ_xxx) in its diagram.');
            }

            // B. Functional Requirement Link
            const reqLinks = node.uplinks.filter(up => up.startsWith('REQ_'));
            if (reqLinks.length === 0) {
                errors.push('Verification Error: Journey must satisfy at least one Functional Requirement (REQ_xxx).');
            } else {
                // Check if at least one linked requirement is "Functional"
                const hasFunctionalReq = reqLinks.some(rid => {
                    const rNode = context.nodeMap.get(rid);
                    const classification = rNode?.metadata?.classification;
                    return classification?.toLowerCase() === 'functional' || 
                           // Secondary check for legacy formats
                           (rid.startsWith('REQ_') && !rNode?.metadata?.classification); 
                });

                if (!hasFunctionalReq) {
                    errors.push('Traceability Violation: Journey must satisfy a [Functional] requirement. Linked requirements: [' + reqLinks.join(', ') + '] are non-functional.');
                }
            }
        }
        
        return errors;
    }
};
