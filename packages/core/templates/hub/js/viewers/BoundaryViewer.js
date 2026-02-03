import { DiagramViewer } from './DiagramViewer.js';

/**
 * @foundryspec COMP_BoundaryViewer
 * Specialized viewer for Boundary diagrams.
 */
export class BoundaryViewer extends DiagramViewer {
    constructor() {
        super();
    }
}

if (!customElements.get('boundary-viewer')) {
    customElements.define('boundary-viewer', BoundaryViewer);
}
