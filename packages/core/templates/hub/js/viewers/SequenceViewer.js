import { DiagramViewer } from './DiagramViewer.js';

/**
 * @foundryspec COMP_SequenceViewer
 * Specialized viewer for Sequence diagrams.
 */
export class SequenceViewer extends DiagramViewer {
    constructor() {
        super();
    }
}

if (!customElements.get('sequence-viewer')) {
    customElements.define('sequence-viewer', SequenceViewer);
}
