import { Rule } from '../types/rules.js';
import { ProjectAsset } from '../types/assets.js';

export const rule: Rule = {
    id: 'footnotes-policy',
    name: 'Footnotes Markdown Policy',
    level: 'file',
    description: "Footnotes are supplementary and must be in Markdown format.",
    target: {
        pathPattern: '**/footnotes/*'
    },
    type: 'structural',
    enforcement: 'error',
    validate: (asset: ProjectAsset) => {
        const errors: string[] = [];
        if (!asset.relPath.endsWith('.md')) {
            errors.push('Footnotes must be Markdown (.md) files.');
        }
        
        const required = ['title', 'description', 'id'];
        for (const field of required) {
            if (!asset.data[field]) {
                errors.push(`Missing required frontmatter: "${field}"`);
            }
        }
        return errors;
    }
};
