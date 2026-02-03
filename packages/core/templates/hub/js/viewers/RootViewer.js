import { DiagramViewer } from './DiagramViewer.js';

/**
 * @foundryspec COMP_RootViewer
 * Specialized viewer for Root/Navigation diagrams.
 */
export class RootViewer extends DiagramViewer {
    constructor() {
        super();
    }
}

if (!customElements.get('root-viewer')) {
    customElements.define('root-viewer', RootViewer);
}
