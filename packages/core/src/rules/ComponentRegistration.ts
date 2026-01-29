import { Rule } from '../types/rules.js';
import { ProjectAsset } from '../types/assets.js';

export const rule: Rule = {
    id: 'component-registration',
    name: 'Component Registration',
    level: 'folder',
    description: "Registers Components for the Hub. Component models must be classDiagrams.",
    target: {
        idPrefix: 'COMP_',
        pathPattern: 'components/*'
    },
    type: 'syntax',
    enforcement: 'error',
    hub: {
        id: 'GRP_Components',
        title: 'Components'
    },
    validate: (asset: ProjectAsset) => {
        const errors: string[] = [];
        // Only validate Mermaid files for syntax
        if (!asset.relPath.endsWith('.mermaid')) return errors;

        if (!asset.content.trim().startsWith('classDiagram')) {
             errors.push('Components must use "classDiagram" syntax.');
        }
        return errors;
    }
};
