import { DiagramViewer } from './DiagramViewer.js';
import { setActiveNodeId } from '../state.js';
import { openPersonaDrawer } from '../ui.js';

/**
 * @foundryspec COMP_PersonaViewer
 * Specialized viewer for Persona mindmaps.
 * Handles semantic actions like Goal editing, Journey linking, etc.
 */
export class PersonaViewer extends DiagramViewer {
    constructor() {
        super();
    }

    /**
     * Override context menu to provide semantic actions
     */
    handleContextMenu(event, nodeId, _element) {
        const semanticType = this.detectSemanticNode(nodeId);
        
        // Always hide structural items in the Persona View for a clean behavioral UX
        this.customizeContextMenu(semanticType);
        
        // Always handle it to prevent interceptors.js from calling resetContextMenu()
        this.showPersonaContextMenu(event, nodeId, semanticType);
        return true;
    }

    detectSemanticNode(nodeId) {
        if (!nodeId) return null;
        const upper = nodeId.toUpperCase();
        if (upper.startsWith('PER_')) return 'PERSONA';
        if (upper.includes('DESCRIPTION')) return 'DESCRIPTION';
        if (upper.includes('GOAL')) return 'GOAL';
        if (upper.includes('ROLE')) return 'ROLE';
        if (upper.includes('REQUIREMENT')) return 'REQUIREMENT';
        if (upper.includes('JOURNEY')) return 'JOURNEY';
        return null;
    }

    showPersonaContextMenu(event, nodeId, _type) {
        const menu = document.getElementById('context-menu');
        if (!menu) return;

        // Set active node for the menu handlers
        setActiveNodeId(nodeId);

        menu.style.display = 'block';
        menu.style.left = `${event.pageX}px`;
        menu.style.top = `${event.pageY}px`;
    }

    customizeContextMenu(type) {
        const menuComments = document.getElementById('menu-comments');
        const menuFootnotes = document.getElementById('menu-footnotes');
        const structuralItems = [
            document.getElementById('menu-data'),
            document.getElementById('menu-sequence'),
            document.getElementById('menu-flow'),
            document.getElementById('menu-state')
        ];
        
        // Persona-specific labels
        if (type === 'PERSONA') {
            menuComments.innerText = 'View Persona Summary';
        } else if (type === 'DESCRIPTION') {
            menuComments.innerText = 'Modify Bio/Description';
        } else if (type === 'GOAL') {
            menuComments.innerText = 'New Goal';
            // TODO: For exisiting goals we should implement an edit functionality, but shouldn't goals actually be statified by requirements?
        } else if (type === 'ROLE') {
            menuComments.innerText = 'Edit Role Title';
        } else if (type === 'REQUIREMENT') {
            menuComments.innerText = 'New Requirement';
        } else if (type === 'JOURNEY') {
            menuComments.innerText = 'New journey';
        } else {
            menuComments.innerText = 'Comments';
        }

        // Personas are Behavioral/Discovery layer - Hide Structural/Implementation items
        structuralItems.forEach(item => {
            if (item) item.style.display = 'none';
        });

        // Footnotes are usually not present on semantic mindmap nodes, hide for cleaner look
        if (menuFootnotes) menuFootnotes.style.display = 'none';
    }

    /**
     * Override click to open specialized drawer
     */
    handleNodeAction(nodeId, _action = 'open') {
        const type = this.detectSemanticNode(nodeId);
        if (type) {
            openPersonaDrawer(nodeId, type);
            return true;
        }
        return false;
    }
}

if (!customElements.get('persona-viewer')) {
    customElements.define('persona-viewer', PersonaViewer);
}
