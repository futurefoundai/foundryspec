import { globals, historyStack, activeNodeId, popHistory, currentViewPath } from './state.js'; // Imports logic
import { initTheme } from './theme.js';
import { fetchComments, startSync, saveComment } from './comments.js';
import { fetchWorks, openWorksSidebar, closeWorksSidebar } from './works.js';
import { loadDiagram } from './diagram.js';
import { resolveActiveNodeId } from './utils.js';
import { openSidebar, openNavigationModal, handleFootnoteSelection, setLoadDiagramFn } from './ui.js';
import { initInterceptors } from './interceptors.js';

// Expose Works functions to window
window.openWorksSidebar = openWorksSidebar;
window.closeWorksSidebar = closeWorksSidebar;

/**
 * Load metadata from JSON files
 */
async function loadMetadata() {
    try {
        const [idMapResponse, metadataResponse, footnoteResponse, implementationResponse, navigationResponse] = await Promise.all([
            fetch('idMap.json'),
            fetch('metadataRegistry.json'),
            fetch('footnoteRegistry.json'),
            fetch('implementationRegistry.json'),
            fetch('navigationRegistry.json')
        ]);
        
        if (idMapResponse.ok) {
            globals.idMap = await idMapResponse.json();
            window.idMap = globals.idMap;
        }
        
        if (metadataResponse.ok) {
            globals.metadataRegistry = await metadataResponse.json();
            window.metadataRegistry = globals.metadataRegistry;
        }

        if (footnoteResponse.ok) {
            globals.footnoteRegistry = await footnoteResponse.json();
            window.footnoteRegistry = globals.footnoteRegistry;
        }

        if (implementationResponse.ok) {
            globals.implementationRegistry = await implementationResponse.json();
            window.implementationRegistry = globals.implementationRegistry;
        }

        if (navigationResponse.ok) {
            globals.navigationRegistry = await navigationResponse.json();
            window.navigationRegistry = globals.navigationRegistry;
        }
        
        return true;
    } catch (error) {
        console.error('[FoundrySpec] Failed to load metadata:', error);
        return false;
    }
}

export async function ioInitCustomCSS() {
    const cssFiles = ['assets/theme.css', 'assets/custom.css'];
    for (const file of cssFiles) {
        try {
            const resp = await fetch(file, { method: 'HEAD' });
            if (resp.ok) {
                const link = document.createElement('link');
                link.rel = 'stylesheet'; link.href = file;
                document.head.appendChild(link);
            }
        } catch { /* empty */ }
    }
}

/**
 * Updates Mermaid theme based on current dark/light mode
 */
export function updateMermaidTheme() {
    const isDark = document.body.classList.contains('dark-mode');
    
    const themeVariables = isDark ? {
        // Dark mode theme
        primaryColor: '#1e293b',
        primaryTextColor: '#f1f5f9',
        primaryBorderColor: '#94a3b8',
        lineColor: '#38bdf8',
        secondaryColor: '#0f172a',
        tertiaryColor: '#334155',
        
        // Sequence diagram specific
        actorBkg: '#1e293b',
        actorBorder: '#94a3b8',
        actorTextColor: '#f1f5f9',
        actorLineColor: '#475569',
        signalColor: '#f1f5f9',
        signalTextColor: '#f1f5f9',
        labelBoxBkgColor: '#0f172a',
        labelBoxBorderColor: '#475569',
        labelTextColor: '#f1f5f9',
        loopTextColor: '#f1f5f9',
        noteBorderColor: '#38bdf8',
        noteBkgColor: '#1e293b',
        noteTextColor: '#f1f5f9',
        activationBorderColor: '#38bdf8',
        activationBkgColor: '#334155',
        sequenceNumberColor: '#ffffff',
        
        // Alt/Loop/Opt boxes
        altSectionBkgColor: 'rgba(15, 23, 42, 0.3)',
        altSectionBorderColor: '#475569'
    } : {
        // Light mode theme
        primaryColor: '#2563eb',
        primaryTextColor: '#1e293b',
        primaryBorderColor: '#334155',
        lineColor: '#2563eb',
        secondaryColor: '#f1f5f9',
        tertiaryColor: '#e2e8f0',
        
        // Sequence diagram specific
        actorBkg: '#ffffff',
        actorBorder: '#334155',
        actorTextColor: '#1e293b',
        actorLineColor: '#64748b',
        signalColor: '#1e293b',
        signalTextColor: '#1e293b',
        labelBoxBkgColor: '#f8f9fa',
        labelBoxBorderColor: '#64748b',
        labelTextColor: '#1e293b',
        loopTextColor: '#1e293b',
        noteBorderColor: '#2563eb',
        noteBkgColor: '#f1f5f9',
        noteTextColor: '#1e293b',
        activationBorderColor: '#2563eb',
        activationBkgColor: '#e0e7ff',
        sequenceNumberColor: '#1e293b',
        
        // Alt/Loop/Opt boxes
        altSectionBkgColor: 'rgba(241, 245, 249, 0.5)',
        altSectionBorderColor: '#64748b'
    };
    
    globals.mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'base',
        themeVariables
    });
}

export async function initApp() {
    // Inject dependency
    setLoadDiagramFn(loadDiagram);

    const viewer = document.getElementById('viewer');
    const backButton = document.getElementById('back-button');
    const saveCommentBtn = document.getElementById('save-comment-btn');
    const sidebarSaveBtn = document.getElementById('sidebar-save-btn');
    const contextMenu = document.getElementById('context-menu');
    const searchInput = document.getElementById('search-input');

    const mermaidReady = typeof globals.mermaid !== 'undefined';
    const domReady = !!(backButton && viewer);
    if (!mermaidReady || !domReady) { setTimeout(initApp, 200); return; }

    // Load metadata from JSON files
    const metadataLoaded = await loadMetadata();
    if (!metadataLoaded) {
        console.error('[FoundrySpec] Failed to load metadata, some features may not work');
    }

    // Initialize Mermaid with theme based on current mode
    updateMermaidTheme();

    // Initialize Click Interceptors
    initInterceptors();

    // Event Listeners
    // Node interaction is now handled by Interceptors and Specialized Viewers

    document.addEventListener('click', (e) => { 
        if (contextMenu && !contextMenu.contains(e.target)) contextMenu.style.display = 'none'; 
    });

    document.getElementById('menu-comments').addEventListener('click', () => openSidebar(activeNodeId)); // live binding
    document.getElementById('menu-footnotes').addEventListener('click', () => handleFootnoteSelection(activeNodeId));
    document.getElementById('menu-data').addEventListener('click', () => openSidebar(activeNodeId));
    document.getElementById('menu-sequence').addEventListener('click', () => openSidebar(activeNodeId));
    document.getElementById('menu-flow').addEventListener('click', () => openSidebar(activeNodeId));
    document.getElementById('menu-state').addEventListener('click', () => openSidebar(activeNodeId));
    
    if (saveCommentBtn) saveCommentBtn.addEventListener('click', () => saveComment(false));
    if (sidebarSaveBtn) sidebarSaveBtn.addEventListener('click', () => saveComment(true));

    // Navigation
    viewer.addEventListener('click', (e) => {
        let target = e.target;
        if (target.closest('a')) return;
        const nodeContainer = target.closest('.node, .mindmap-node, .cluster, .requirementBox, text, .edgeLabel, .actor, g[name], g[id*="actor"]');
        if (!nodeContainer) return;

        const key = resolveActiveNodeId(nodeContainer, viewer, globals.idMap, currentViewPath);

        if (key) {
            // Check if node has metadata (downlinks or references)
            const metadata = globals.metadataRegistry[key];
            
            if (metadata) {
                // Collect all navigation targets from downlinks and backlinks
                const navigationTargets = [];
                
                // Helper to convert string | string[] to array
                const toArray = (val) => {
                    if (!val) return [];
                    return Array.isArray(val) ? val : [val];
                };
                
                // Add downlinks
                const downlinks = toArray(metadata.downlinks);
                downlinks.forEach(dlId => {
                    if (globals.idMap[dlId]) {
                        const dlTargets = globals.idMap[dlId];
                        const dlTarget = Array.isArray(dlTargets) ? dlTargets[0] : dlTargets;
                        navigationTargets.push({
                            ...dlTarget,
                            title: `${dlId} (downlink)`,
                            id: dlId,
                            category: 'downlink'
                        });
                    }
                });
                
                // Add references (backlinks) - diagrams that reference this node
                const references = toArray(metadata.referencedBy);
                references.forEach(refId => {
                    if (globals.idMap[refId]) {
                        const refTargets = globals.idMap[refId];
                        const refTarget = Array.isArray(refTargets) ? refTargets[0] : refTargets;
                        navigationTargets.push({
                            ...refTarget,
                            title: `${refId} (references this)`,
                            id: refId,
                            category: 'reference'
                        });
                    }
                });
                
                // If we have navigation targets from metadata, use them
                if (navigationTargets.length === 1) {
                    loadDiagram(navigationTargets[0].path);
                    return;
                } else if (navigationTargets.length > 1) {
                    openNavigationModal(key, navigationTargets);
                    return;
                }
            }
            
            // Fallback: use idMap targets (current behavior for nodes without metadata)
            if (globals.idMap[key]) {
                const rawTargets = globals.idMap[key];
                const targets = Array.isArray(rawTargets) ? rawTargets : [{ path: rawTargets, title: key, type: 'diagram' }];
                
                if (targets.length === 1) {
                    loadDiagram(targets[0].path);
                } else {
                    openNavigationModal(key, targets);
                }
            }
        }
    });

    backButton.addEventListener('click', () => { 
        // access historyStack from state
        if (historyStack.length > 1) { 
            // We need to modify historyStack.
            popHistory(); // Pop current
            const prev = popHistory(); // Pop prev to load it (loadDiagram will push it back)
            // Wait, logic:
            // Stack: [A, B]. Current is B. Back -> Load A.
            // Pop B -> [A].
            // Load A -> Push A -> [A, A]?
            // loadDiagram checks if (last != new).
            // So we pop B. Stack is [A].
            // call loadDiagram(A).
            // loadDiagram sees stack top is A. Does not push.
            // Stack remains [A].
            // Correct.
            // Implementation:
            // historyStack.pop(); loadDiagram(historyStack.pop(), true);
            // This pops B. Then pops A (returns A). Stack empty.
            // loadDiagram(A). Pushes A. Stack [A].
            // Correct.
            loadDiagram(prev, true);
        } 
    });

    // Search
     if (searchInput) {
        const resultsContainer = document.createElement('div');
        resultsContainer.id = 'search-results';
        resultsContainer.style.cssText = `
            position: absolute; top: 60px; right: 20px; background: var(--bg-secondary); border: 1px solid var(--border);
            border-radius: 4px; max-height: 300px; overflow-y: auto; width: 300px; z-index: 1000;
            display: none; box-shadow: var(--card-shadow);
        `;
        document.getElementById('header').appendChild(resultsContainer);

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            resultsContainer.innerHTML = '';
            if (query.length < 2) { resultsContainer.style.display = 'none'; return; }

            const matches = Object.keys(globals.idMap).filter(k => k.toLowerCase().includes(query));
            if (matches.length > 0) {
                resultsContainer.style.display = 'block';
                matches.forEach(match => {
                    const item = document.createElement('div');
                    item.className = 'search-item';
                    item.textContent = match;
                    item.style.cssText = 'padding: 8px; cursor: pointer; border-bottom: 1px solid var(--border); color: var(--text-primary);';
                    item.onmouseover = () => item.style.background = 'var(--bg-primary)';
                    item.onmouseout = () => item.style.background = 'transparent';
                    item.onclick = () => {
                        const rawTargets = globals.idMap[match];
                        const targets = Array.isArray(rawTargets) ? rawTargets : [{ path: rawTargets, title: match, type: 'diagram' }];
                        
                        if (targets.length === 1) {
                            loadDiagram(targets[0].path);
                        } else {
                            openNavigationModal(match, targets);
                        }
                        resultsContainer.style.display = 'none';
                        searchInput.value = '';
                    };
                    resultsContainer.appendChild(item);
                });
            } else {
                resultsContainer.style.display = 'none';
            }
        });
        
        document.addEventListener('click', (e) => {
            if (e.target !== searchInput && e.target !== resultsContainer) {
                resultsContainer.style.display = 'none';
            }
        });
    }

    ioInitCustomCSS(); // Using local module function
    await fetchComments(); 
    await fetchWorks(); // Initialize Works
    startSync(); 
    
    // URL-based view persistence
    const urlParams = new URLSearchParams(window.location.search);
    const initialView = urlParams.get('view') || 'assets/root.mermaid';
    
    // Set initial state for popstate
    window.history.replaceState({ path: initialView }, '', window.location.href);
    
    loadDiagram(initialView);

    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.path) {
            loadDiagram(e.state.path, true);
        }
    });

    initTheme();
}

// Expose updateMermaidTheme to window for theme toggle
window.updateMermaidTheme = updateMermaidTheme;
