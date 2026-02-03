import './DiagramViewer.js';
import './PersonaViewer.js';
import './JourneyViewer.js';
import './ComponentViewer.js';
import './SequenceViewer.js';
import './DataViewer.js';
import './StateViewer.js';
import './FlowViewer.js';
import './BoundaryViewer.js';
import './ContextViewer.js';
import './RequirementViewer.js';
import './RootViewer.js';

/**
 * @foundryspec COMP_ViewerFactory
 */
export class ViewerFactory {
    /**
     * Creates the appropriate viewer element for a given diagram
     * @param {string} path 
     * @param {string} _diagramType 
     * @returns {HTMLElement}
     */
    static create(path, _diagramType) {
        // path example: "personas/PER_User.mermaid"
        // or "/requirements/requirements.mermaid"
        
        const parts = path.split('/').filter(p => p); // filter empty strings from leading slash
        const filename = parts[parts.length - 1];
        const parentFolder = parts.length > 1 ? parts[parts.length - 2] : '';
        
        // 1. Check for explicit root.mermaid
        if (filename === 'root.mermaid') {
            return document.createElement('root-viewer');
        }

        // 2. Check for Navigation/Root files (filename matches parent folder)
        // e.g. "requirements/requirements.mermaid"
        const nameWithoutExt = filename.replace(/\.(mermaid|md)$/, '');
        if (parentFolder && nameWithoutExt === parentFolder) {
            return document.createElement('root-viewer');
        }

        // 3. Fallback to Standard Categories
        let category = '';
        
        const categories = [
            'personas', 'journeys', 'components', 'sequences', 
            'data', 'states', 'flows', 'boundaries', 
            'context', 'requirements'
        ];
        
        for (const cat of categories) {
            if (parts.includes(cat)) {
                category = cat;
                break;
            }
        }

        switch (category) {
            case 'personas':
                return document.createElement('persona-viewer');
            case 'journeys':
                return document.createElement('journey-viewer');
            case 'components':
                return document.createElement('component-viewer');
            case 'sequences':
                return document.createElement('sequence-viewer');
            case 'data':
                return document.createElement('data-viewer');
            case 'states':
                return document.createElement('state-viewer');
            case 'flows':
                return document.createElement('flow-viewer');
            case 'boundaries':
                return document.createElement('boundary-viewer');
            case 'context':
                return document.createElement('context-viewer');
            case 'requirements':
                return document.createElement('requirement-viewer');
            default:
                // Default Viewer
                return document.createElement('diagram-viewer');
        }
    }
}
