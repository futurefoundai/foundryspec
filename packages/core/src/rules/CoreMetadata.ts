import { Rule } from '../types/rules.js';
import { ProjectAsset } from '../types/assets.js';

export const rule: Rule = {
    id: 'core-metadata',
    name: 'Core Document Metadata',
    level: 'file',
    description: "Every file requires standard frontmatter for identification and Hub integration.",
    target: {
        pathPattern: '**/*.mermaid'
    },
    type: 'metadata',
    enforcement: 'error',
    validate: (asset: ProjectAsset) => {
        const errors: string[] = [];
        const required = ['title', 'description', 'id'];
        for (const field of required) {
            if (!asset.data[field]) {
                errors.push(`Missing required frontmatter: "${field}"`);
            }
        }
        return errors;
    }
};
