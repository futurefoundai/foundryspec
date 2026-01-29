import { Rule } from '../types/rules.js';
import { ProjectAsset } from '../types/assets.js';

export const rule: Rule = {
    id: 'state-registration',
    name: 'State Machine Registration',
    level: 'folder',
    description: "State machines accessible per-node via context menu for modeling behavior.",
    target: {
        idPrefix: 'STATE_',
        pathPattern: 'states/*'
    },
    type: 'structural',
    enforcement: 'error',
    validate: (asset: ProjectAsset) => {
        const errors: string[] = [];
        if (!asset.relPath.endsWith('.mermaid')) return errors;

        if (!asset.content.trim().startsWith('stateDiagram')) {
             errors.push('State Machines must use "stateDiagram" syntax.');
        }
        return errors;
    }
};
