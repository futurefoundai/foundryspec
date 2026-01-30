import { Rule, ProjectContext } from '../types/rules.js';
import { ProjectAsset } from '../types/assets.js';
import chalk from 'chalk';

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

        // 2. Deprecation Check: 'uplink' in frontmatter
        if (asset.data.uplink) {
            console.warn(chalk.yellow(`\n⚠️  Deprecation Warning: Manual 'uplink' detected in ${asset.relPath}.
   👉 Innovation: Requirements should be owned by their parents using '-contains->' in the parent's diagram.
   Please migrate to the Ownership model to ensure architectural integrity.`));
        }

        // 3. Traceability
        if (asset.data.id && context.nodeMap.has(asset.data.id)) {
            // Uplinks (Trace To) logic is handled by BuildManager's graph construction
        }

        return errors;
    }
};
