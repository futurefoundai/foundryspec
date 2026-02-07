import { setCurrentContainer, setCurrentViewPath, pushHistory } from './state.js';
import { updateUI, openFootnoteSidebar } from './ui.js';
import { ViewerFactory } from './viewers/ViewerFactory.js';

/**
 * @foundryspec COMP_DiagramLoader
 * Central loading logic for diagrams and documents.
 */
export async function loadDiagram(filePath, isBack = false) {
    const viewer = document.getElementById('viewer');

    try {
        const response = await fetch(filePath); 
        if (!response.ok) throw new Error(`File not found: ${filePath}`);
        
        let content = await response.text(); 
        const normalizedPath = filePath.replace(/\\/g, '/');
        setCurrentViewPath(normalizedPath);
        
        // Handle Markdown Documents (Footnotes)
        if (filePath.endsWith('.md')) {
            const cleanContent = content.replace(/^---[\s\S]*?---\s*/, '');
            openFootnoteSidebar(filePath, cleanContent);
            return;
        }
        
        // Detect diagram type for factory
        let diagramType = 'mermaid';
        if (content.includes('mindmap')) diagramType = 'mindmap';
        if (content.includes('sequenceDiagram')) diagramType = 'sequence';
        if (normalizedPath.includes('/personas/')) diagramType = 'persona';

        // Create specialized viewer via Factory
        const newViewer = ViewerFactory.create(normalizedPath, diagramType);
        newViewer.className = 'diagram-container ' + (isBack ? 'initial-reverse' : 'initial'); 
        
        const stateContainer = (await import('./state.js')).currentContainer;
        
        const showNewDiagram = async () => {
            viewer.appendChild(newViewer); 
            
            // Initialize the web component
            if (typeof newViewer.init === 'function') {
                await newViewer.init(normalizedPath, content, diagramType);
            }
            
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    newViewer.classList.remove(isBack ? 'initial-reverse' : 'initial'); 
                    newViewer.classList.add('fade-in');
                });
            });
            setCurrentContainer(newViewer);
        };

        // Transition Logic
        if (stateContainer) { 
             stateContainer.classList.add(isBack ? 'fade-out-reverse' : 'fade-out'); 
             setTimeout(() => { 
                 if (stateContainer.parentNode) stateContainer.parentNode.removeChild(stateContainer);
                 showNewDiagram();
             }, 250); 
        } else {
             showNewDiagram();
        }
        
        // History Tracking
        const stack = (await import('./state.js')).historyStack;
        if (stack.length === 0 || stack[stack.length - 1] !== normalizedPath) {
            pushHistory(normalizedPath);
            
            if (!isBack) {
                const url = new URL(window.location);
                url.searchParams.set('view', normalizedPath);
                window.history.pushState({ path: normalizedPath }, '', url);
            }
        }
        updateUI(); // Breadcrumbs

        // Listen for internal navigation events from viewers
        newViewer.addEventListener('diagram-navigate', (e) => {
            loadDiagram(e.detail.href);
        });

    } catch (error) {
        console.error('[FoundrySpec] Error loading diagram:', error);
        const errDiv = document.createElement('div'); 
        errDiv.style.color = '#ef4444'; 
        errDiv.style.padding = '2rem';
        errDiv.style.fontWeight = 'bold'; 
        errDiv.style.fontFamily = "'Outfit', sans-serif";
        errDiv.innerText = `Error loading diagram: ${filePath}\n${error.message}`;
        if (viewer) { 
            viewer.innerHTML = ''; 
            viewer.appendChild(errDiv); 
        }
    }
}

// Expose to window for UI onclicks
window.loadDiagram = loadDiagram;

/**
 * Reloads the current diagram (used when theme changes)
 */
export async function reloadCurrentDiagram() {
    const currentPath = (await import('./state.js')).currentViewPath;
    if (currentPath && !currentPath.endsWith('.md')) {
        loadDiagram(currentPath, false); // Simplest way to reload with new theme/factory logic
    }
}

window.reloadCurrentDiagram = reloadCurrentDiagram;
