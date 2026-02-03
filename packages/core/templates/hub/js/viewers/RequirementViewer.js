import { DiagramViewer } from './DiagramViewer.js';

/**
 * @foundryspec COMP_RequirementViewer
 * Specialized viewer for Requirement diagrams.
 */
export class RequirementViewer extends DiagramViewer {
    constructor() {
        super();
    }
}

if (!customElements.get('requirement-viewer')) {
    customElements.define('requirement-viewer', RequirementViewer);
}
