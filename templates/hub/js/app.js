import { globals, historyStack, activeNodeId, setActiveNodeId, popHistory } from './state.js'; // Imports logic
import { initTheme } from './theme.js';
import { fetchComments, startSync, saveComment } from './comments.js';
import { loadDiagram } from './diagram.js';
import { resolveActiveNodeId } from './utils.js';
import { openSidebar, openNavigationModal, handleFootnoteSelection, setLoadDiagramFn, updateUI } from './ui.js';

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
        } catch (_e) { /* empty */ }
    }
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

    globals.mermaid.initialize({
        startOnLoad: false, securityLevel: 'loose', theme: 'base',
        themeVariables: { primaryColor: '#1e293b', primaryTextColor: '#f8fafc', primaryBorderColor: '#334155', lineColor: '#38bdf8' }
    });

    // Event Listeners
    viewer.addEventListener('contextmenu', (e) => {
        const node = e.target.closest('.node, .mindmap-node, .cluster, .requirementBox, text, .edgeLabel, .actor, g[name], g[id*="actor"]');
        if (!node) return;
        e.preventDefault();
        // Use imported util
        const resolvedId = resolveActiveNodeId(node, viewer, globals.idMap);
        if (resolvedId) {
            // Update state? ui.openSidebar does it.
            // But context menu just shows up.
            // We need to set activeNodeId in state?
            // Actually, context menu click handlers use 'activeNodeId'.
            // So we must set it.
            setActiveNodeId(resolvedId);

            contextMenu.style.display = 'block';
            contextMenu.style.left = `${e.clientX}px`; contextMenu.style.top = `${e.clientY}px`;
        }
    });

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

        const key = resolveActiveNodeId(nodeContainer, viewer, globals.idMap);

        if (key && globals.idMap[key]) {
            const rawTargets = globals.idMap[key];
            const targets = Array.isArray(rawTargets) ? rawTargets : [{ path: rawTargets, title: key, type: 'diagram' }];
            
            if (targets.length === 1) {
                loadDiagram(targets[0].path);
            } else {
                openNavigationModal(key, targets);
            }
            return;
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
    startSync(); 
    loadDiagram('assets/root.mermaid');
    initTheme();
}

// Attach init to window? No, purely internal to modules?
// We need to call it.
