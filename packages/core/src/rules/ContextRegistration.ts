import { Rule } from '../types/rules.js';
import { ProjectAsset } from '../types/assets.js';

export const rule: Rule = {
    id: 'context-registration',
    name: 'Context Model Registration',
    level: 'folder',
    description: "Registers Context models for the Hub. Context models use graph syntax.",
    target: {
        idPrefix: 'CTX_',
        pathPattern: 'context/*'
    },
    type: 'syntax',
    enforcement: 'error',
    hub: {
        id: 'GRP_Context',
        title: 'Context'
    },
    validate: (asset: ProjectAsset) => {
        const errors: string[] = [];
        if (!asset.relPath.endsWith('.mermaid')) return errors;
        
        if (!asset.content.trim().startsWith('graph') && !asset.content.trim().startsWith('flowchart')) {
             errors.push('Context models must use "graph" or "flowchart" syntax.');
        }
        return errors;
    }
};
