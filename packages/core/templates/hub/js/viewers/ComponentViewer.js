import { DiagramViewer } from './DiagramViewer.js';

/**
 * @foundryspec COMP_ComponentViewer
 * Specialized viewer for Component diagrams.
 */
export class ComponentViewer extends DiagramViewer {
    constructor() {
        super();
    }
}

if (!customElements.get('component-viewer')) {
    customElements.define('component-viewer', ComponentViewer);
}
