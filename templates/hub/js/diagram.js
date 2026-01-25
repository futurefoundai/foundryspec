import { globals, setCurrentContainer, setCurrentViewPath, pushHistory } from './state.js';
import { resolvePath } from './utils.js';
import { applyCursors } from './decorators.js';
import { updateUI, openFootnoteSidebar } from './ui.js';

/**
 * @foundryspec COMP_ClickInterceptor
 */
export async function loadDiagram(filePath, isBack = false) {
    const viewer = document.getElementById('viewer');
    // We use local var for current container in logic basically. 

    try {
        const response = await fetch(filePath); if (!response.ok) throw new Error(`File not found: ${filePath}`);
        let content = await response.text(); 
        setCurrentViewPath(filePath.replace(/\\/g, '/'));
        
        content = content.replace(/^---[\s\S]*?---\s*/, '');
        if (filePath.endsWith('.md')) {
            openFootnoteSidebar(filePath, content);
            return;
        }
        
        const { svg } = await globals.mermaid.render('mermaid-svg-' + Date.now(), content);
        const newContainer = document.createElement('div'); 
        newContainer.className = 'diagram-container ' + (isBack ? 'initial-reverse' : 'initial'); 
        newContainer.innerHTML = svg;
        
        const svgEl = newContainer.querySelector('svg'); 
        if (svgEl) { svgEl.style.width = '100%'; svgEl.style.height = '100%'; svgEl.style.maxWidth = 'none'; }
        
        const stateContainer = (await import('./state.js')).currentContainer;
        
        const showNewDiagram = () => {
            viewer.appendChild(newContainer); 
            applyCursors(newContainer);
            
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    newContainer.classList.remove(isBack ? 'initial-reverse' : 'initial'); 
                    newContainer.classList.add('fade-in');
                    if (svgEl) { 
                        try { 
                            window.panZoomInstance = globals.svgPanZoom(svgEl, { zoomEnabled: true, controlIconsEnabled: true, fit: true, center: true, minZoom: 0.1 }); 
                        } catch (_e) { /* empty */ } 
                    }
                });
            });
            setCurrentContainer(newContainer);
        };

        if (stateContainer) { 
             // Faster exit
             stateContainer.classList.add(isBack ? 'fade-out-reverse' : 'fade-out'); 
             
             // Wait for opacity transition (defined in CSS as 0.2s or similar)
             setTimeout(() => { 
                 if (stateContainer.parentNode) stateContainer.parentNode.removeChild(stateContainer);
                 showNewDiagram();
             }, 250); 
        } else {
             showNewDiagram();
        }
        
        // History Logic
        const stack = (await import('./state.js')).historyStack;
        if (stack.length === 0 || stack[stack.length - 1] !== filePath) {
            pushHistory(filePath);
        }
        updateUI(); // Breadcrumbs

        if (svgEl) {
            const links = svgEl.querySelectorAll('a');
            links.forEach(link => { 
                link.addEventListener('click', (e) => { 
                    e.preventDefault(); 
                    const href = link.getAttribute('href') || link.getAttribute('xlink:href'); 
                    if (href) { 
                        if (href.startsWith('http') || href.startsWith('mailto')) { 
                            window.open(href, '_blank'); 
                        } else { 
                            const resolved = resolvePath(filePath, href); 
                            loadDiagram(resolved); 
                        } 
                    } 
                }); 
            });
        }
    } catch (error) {
        console.error('[FoundrySpec] Error loading diagram:', error);
        const errDiv = document.createElement('div'); errDiv.style.color = '#ef4444'; errDiv.style.padding = '2rem';
        errDiv.style.fontWeight = 'bold'; errDiv.innerText = `Error loading diagram: ${filePath}\n${error.message}`;
        if (viewer) { viewer.innerHTML = ''; viewer.appendChild(errDiv); }
    }
}

// Expose to window for UI onclicks
window.loadDiagram = loadDiagram;
