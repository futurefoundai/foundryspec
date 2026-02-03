import { DiagramViewer } from './DiagramViewer.js';

/**
 * @foundryspec COMP_DataViewer
 * Specialized viewer for Data diagrams.
 */
export class DataViewer extends DiagramViewer {
    constructor() {
        super();
    }
}

if (!customElements.get('data-viewer')) {
    customElements.define('data-viewer', DataViewer);
}
