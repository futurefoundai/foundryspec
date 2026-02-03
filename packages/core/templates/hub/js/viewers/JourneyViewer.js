import { DiagramViewer } from './DiagramViewer.js';

/**
 * @foundryspec COMP_JourneyViewer
 * Specialized viewer for Journey diagrams.
 */
export class JourneyViewer extends DiagramViewer {
    constructor() {
        super();
    }
}

if (!customElements.get('journey-viewer')) {
    customElements.define('journey-viewer', JourneyViewer);
}
