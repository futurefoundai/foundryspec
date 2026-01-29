import { Rule } from '../types/rules.js';
import { ProjectAsset } from '../types/assets.js';

export const rule: Rule = {
    id: 'data-registration',
    name: 'Data Model Registration',
    level: 'folder',
    description: "ER diagrams accessible per-node via context menu for AI collaboration.",
    target: {
        idPrefix: 'DATA_',
        pathPattern: 'data/*'
    },
    type: 'structural',
    enforcement: 'error',
    validate: (asset: ProjectAsset) => {
        const errors: string[] = [];
        if (!asset.relPath.endsWith('.mermaid')) return errors;

        // 1. Syntax Check
        if (!asset.content.trim().startsWith('erDiagram')) {
             errors.push('Data models must use "erDiagram" syntax.');
        }
        return errors;
    }
};
