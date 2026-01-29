import { Rule } from '../types/rules.js';
import { ProjectAsset } from '../types/assets.js';

export const rule: Rule = {
    id: 'boundary-registration',
    name: 'Boundary Definition Registration',
    level: 'folder',
    description: "Registers Boundary definitions for the Hub. Boundary models use graph syntax.",
    target: {
        idPrefix: 'BND_',
        pathPattern: 'boundaries/*'
    },
    type: 'syntax',
    enforcement: 'error',
    hub: {
        id: 'GRP_Boundaries',
        title: 'Boundaries'
    },
    validate: (asset: ProjectAsset) => {
        const errors: string[] = [];
        if (!asset.relPath.endsWith('.mermaid')) return errors;

        if (!asset.content.trim().startsWith('graph') && !asset.content.trim().startsWith('flowchart')) {
             errors.push('Boundary models must use "graph" or "flowchart" syntax.');
        }
        return errors;
    }
};
