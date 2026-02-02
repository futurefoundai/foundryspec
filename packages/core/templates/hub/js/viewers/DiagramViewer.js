import { globals } from '../state.js';
import { applyCursors } from '../decorators.js';

/**
 * @foundryspec COMP_DiagramViewer
 * Base class for all diagram viewers in the FoundrySpec Hub.
 */
export class DiagramViewer extends HTMLElement {
    constructor() {
        super();
        this.filePath = '';
        this.content = '';
        this.svgEl = null;
        this.panZoom = null;
        this.diagramType = 'unknown';
    }

    /**
     * Initialize the viewer with content
     */
    async init(filePath, content, diagramType = 'unknown') {
        this.filePath = filePath;
        this.content = content;
        this.diagramType = diagramType;
        await this.render();
    }

    /**
     * Main rendering logic
     */
    async render() {
        try {
            // Clear existing content
            this.innerHTML = '';
            
            // Clean content for rendering (stop double frontmatter cleaning if handled elsewhere)
            const cleanContent = this.content.replace(/^---[\s\S]*?---\s*/, '');
            
            const { svg } = await globals.mermaid.render('mermaid-svg-' + Date.now(), cleanContent);
            
            // Create a wrapper for transitions if needed, or just set innerHTML
            this.className = 'diagram-container fade-in';
            this.innerHTML = svg;
            
            this.svgEl = this.querySelector('svg');
            if (this.svgEl) {
                this.setupSvg();
                this.setupPanZoom();
            }
            
            applyCursors(this);
            this.attachBaseEvents();
        } catch (error) {
            this.renderError(error);
        }
    }

    setupSvg() {
        if (!this.svgEl) return;
        this.svgEl.style.width = '100%';
        this.svgEl.style.height = '100%';
        this.svgEl.style.maxWidth = 'none';
    }

    setupPanZoom() {
        if (!this.svgEl) return;
        try {
            this.panZoom = globals.svgPanZoom(this.svgEl, {
                zoomEnabled: true,
                controlIconsEnabled: true,
                fit: true,
                center: true,
                minZoom: 0.1
            });
        } catch (e) {
            console.warn('[FoundrySpec] Pan-zoom initialization failed:', e);
        }
    }

    attachBaseEvents() {
        if (!this.svgEl) return;
        
        // Native Link Handling
        const links = this.svgEl.querySelectorAll('a');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const href = link.getAttribute('href') || link.getAttribute('xlink:href');
                if (href) {
                    if (href.startsWith('http') || href.startsWith('mailto')) {
                        window.open(href, '_blank');
                    } else {
                        this.dispatchEvent(new CustomEvent('diagram-navigate', {
                            detail: { href, sourcePath: this.filePath },
                            bubbles: true,
                            composed: true
                        }));
                    }
                }
            });
        });
    }

    renderError(error) {
        console.error('[FoundrySpec] Viewer Error:', error);
        this.innerHTML = `
            <div style="color: #ef4444; padding: 2rem; font-weight: bold; font-family: 'Outfit', sans-serif;">
                <h3>Error Rendering Diagram</h3>
                <p style="font-size: 0.9rem; font-family: monospace;">${error.message}</p>
            </div>
        `;
    }

    /**
     * Hook for context menus (right-click)
     * To be overridden by specialized viewers
     */
    handleContextMenu(event, nodeId, element) {
        return false; // Not handled by default
    }

    /**
     * Hook for specialized node actions
     */
    handleNodeAction(nodeId, action) {
        console.log(`[DiagramViewer] Generic Action: ${action} on ${nodeId}`);
    }
}

if (!customElements.get('diagram-viewer')) {
    customElements.define('diagram-viewer', DiagramViewer);
}
