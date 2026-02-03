import { DiagramViewer } from './DiagramViewer.js';

/**
 * @foundryspec COMP_FlowViewer
 * Specialized viewer for Flow diagrams.
 */
export class FlowViewer extends DiagramViewer {
    constructor() {
        super();
    }
}

if (!customElements.get('flow-viewer')) {
    customElements.define('flow-viewer', FlowViewer);
}
