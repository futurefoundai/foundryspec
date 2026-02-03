import { DiagramViewer } from './DiagramViewer.js';

/**
 * @foundryspec COMP_ContextViewer
 * Specialized viewer for Context diagrams.
 */
export class ContextViewer extends DiagramViewer {
    constructor() {
        super();
    }
}

if (!customElements.get('context-viewer')) {
    customElements.define('context-viewer', ContextViewer);
}
