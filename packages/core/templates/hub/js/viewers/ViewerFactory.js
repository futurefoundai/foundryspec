/**
 * @foundryspec COMP_ViewerFactory
 */
export class ViewerFactory {
    /**
     * Creates the appropriate viewer element for a given diagram
     * @param {string} filePath 
     * @param {string} diagramType 
     * @returns {HTMLElement}
     */
    static create(filePath, diagramType) {
        // Detect Personas based on project structure (discovery/behavioral layer).
        // Standard Mermaid 'mindmap' type is used technically, but we override with a specialized viewer for this path.
        if (filePath.includes('/personas/')) {
             return document.createElement('persona-viewer');
        }

        // 2. Future: SequenceViewer, DataViewer, etc.
        
        // 3. Default Viewer
        return document.createElement('diagram-viewer');
    }
}
