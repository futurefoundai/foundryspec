import { Rule } from '../types/rules.js';
import { ProjectAsset } from '../types/assets.js';

export const rule: Rule = {
    id: 'sequence-registration',
    name: 'Sequence Registration',
    level: 'folder',
    description: "Process sequences accessible per-node via context menu. Participants must be valid ecosystem nodes.",
    target: {
        idPrefix: 'SEQ_',
        pathPattern: 'sequences/*'
    },
    type: 'structural',
    enforcement: 'error',
    validate: (asset: ProjectAsset) => {
        const errors: string[] = [];
        if (!asset.relPath.endsWith('.mermaid')) return errors;

        if (!asset.content.trim().startsWith('sequenceDiagram')) {
             errors.push('Sequences must use "sequenceDiagram" syntax.');
        }
        return errors;
    }
};
