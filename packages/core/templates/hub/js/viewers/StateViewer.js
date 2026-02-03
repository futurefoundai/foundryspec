import { DiagramViewer } from './DiagramViewer.js';

/**
 * @foundryspec COMP_StateViewer
 * Specialized viewer for State diagrams.
 */
export class StateViewer extends DiagramViewer {
    constructor() {
        super();
    }
}

if (!customElements.get('state-viewer')) {
    customElements.define('state-viewer', StateViewer);
}
