import { Rule } from '../types/rules.js';
import { ProjectAsset } from '../types/assets.js';

export const rule: Rule = {
    id: 'flow-registration',
    name: 'Flow Registration',
    level: 'folder',
    description: "Logical flows accessible per-node via context menu for AI collaboration.",
    target: {
        idPrefix: 'FLOW_',
        pathPattern: 'flows/*'
    },
    type: 'structural',
    enforcement: 'error',
    validate: (asset: ProjectAsset) => {
        const errors: string[] = [];
        if (!asset.relPath.endsWith('.mermaid')) return errors;

        if (!asset.content.trim().startsWith('flowchart')) {
             errors.push('Flows must use "flowchart" syntax.');
        }
        return errors;
    }
};
