// --- Globals & State ---
let historyStack = [];
let currentContainer = null;
let panZoomInstance = null;
let viewer, backButton, breadcrumbs, modalBackdrop, modalBody, modalTitle;
let contextMenu, commentOverlay, commentList, newCommentInput, saveCommentBtn;
let activeNodeId = null;
let currentViewPath = 'root.mermaid';
let commentsRegistry = {};
let lastRegistrySync = 0;

// --- Helpers ---
function getUSI(nodeId, viewPath) {
    if (!nodeId || nodeId === 'undefined') return null;
    const safeProjectId = (typeof projectId !== 'undefined' && !projectId.startsWith('{{')) ? projectId : 'local-dev';
    return `${safeProjectId}#${nodeId}@${viewPath}`;
}

async function injectCustomCSS() {
    const cssFiles = ['assets/theme.css', 'assets/custom.css'];
    for (const file of cssFiles) {
        try {
            const resp = await fetch(file, { method: 'HEAD' });
            if (resp.ok) {
                const link = document.createElement('link');
                link.rel = 'stylesheet'; link.href = file;
                document.head.appendChild(link);
            }
        } catch (e) {}
    }
}

async function fetchComments() {
    try {
        const resp = await fetch('assets/foundry.comments.json?t=' + Date.now());
        if (resp.ok) { 
            commentsRegistry = await resp.json(); 
            if (currentContainer) applyCursors(currentContainer);
        }
    } catch (e) { console.warn('[FoundrySpec] Could not load comments registry.'); }
}

async function startSync() {
    setInterval(async () => {
        try {
            const resp = await fetch('/api/sync');
            if (resp.ok) {
                const { lastModified } = await resp.json();
                if (lastModified > lastRegistrySync) {
                    lastRegistrySync = lastModified;
                    await fetchComments();
                }
            }
        } catch (e) {}
    }, 2000);
}

function applyCursors(container) {
    // Clear existing badges
    container.querySelectorAll('.node-badge').forEach(b => b.remove());

    const nodes = container.querySelectorAll('.nodes .node, .cluster, .mindmap-node, text, .requirementBox, .edgeLabel, .actor, g[id*="actor"], g[name]');
    nodes.forEach(node => {
        let text = node.textContent?.trim() || "";
        const id = node.id || node.getAttribute('id') || node.getAttribute('name');
        const cleanText = text.replace(/^["(\[\{]+|[")\]\}]+$/g, '').trim();
        
        const matchingId = (id && idMap[id] ? id : null) || 
                          (text && idMap[text] ? text : null) || 
                          (cleanText && idMap[cleanText] ? cleanText : null);

        if (matchingId && matchingId !== 'undefined') {
            const usi = getUSI(matchingId, currentViewPath);
            if (!usi) return;
            const hasLocal = commentsRegistry[usi] && commentsRegistry[usi].length > 0;
            const hasAny = Object.keys(commentsRegistry).some(key => key.includes(`#${matchingId}@`));
            
            if (hasAny) {
                node.classList.add('has-comment');
                const totalCount = Object.keys(commentsRegistry)
                    .filter(key => key.includes(`#${matchingId}@`))
                    .reduce((sum, key) => sum + commentsRegistry[key].length, 0);
                injectCommentBadge(node, totalCount, hasLocal);
            }
            node.classList.add('clickable-node');
        }
    });
}

function injectCommentBadge(node, count, isLocal) {
    try {
        const bbox = node.getBBox();
        if (bbox.width === 0) return;

        const x = bbox.x + bbox.width;
        const y = bbox.y;

        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "node-badge");
        // CRITICAL: Ensure badge group does not intercept ANY events
        g.style.pointerEvents = "none";
        
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", x); circle.setAttribute("cy", y); circle.setAttribute("r", "8");
        circle.setAttribute("class", isLocal ? "comment-badge local" : "comment-badge");
        circle.style.fill = isLocal ? "#38bdf8" : "#64748b";
        circle.style.stroke = "#0f172a";
        circle.style.pointerEvents = "none"; // Double-enforce
        
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", x); text.setAttribute("y", y + 3);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("class", "comment-count");
        text.style.fill = "#0f172a"; text.style.fontSize = "10px"; text.style.fontWeight = "bold";
        text.style.pointerEvents = "none";
        text.textContent = count;
        
        g.appendChild(circle); g.appendChild(text);
        node.appendChild(g);
    } catch (e) {}
}

async function initApp() {
    viewer = document.getElementById('viewer');
    backButton = document.getElementById('back-button');
    breadcrumbs = document.getElementById('breadcrumbs');
    modalBackdrop = document.getElementById('modal-backdrop');
    modalBody = document.getElementById('modal-body');
    modalTitle = document.getElementById('modal-title');
    currentContainer = document.getElementById('diagram-container');
    contextMenu = document.getElementById('context-menu');
    commentOverlay = document.getElementById('comment-overlay');
    commentList = document.getElementById('comment-list');
    newCommentInput = document.getElementById('new-comment-input');
    saveCommentBtn = document.getElementById('save-comment-btn');

    const mermaidReady = typeof mermaid !== 'undefined';
    const domReady = !!(backButton && viewer);
    if (!mermaidReady || !domReady) { setTimeout(initApp, 200); return; }

    mermaid.initialize({
        startOnLoad: false, securityLevel: 'loose', theme: 'base',
        themeVariables: { primaryColor: '#1e293b', primaryTextColor: '#f8fafc', primaryBorderColor: '#334155', lineColor: '#38bdf8' }
    });

    // Right-Click Listener (Context Menu)
    viewer.addEventListener('contextmenu', (e) => {
        // Find node even if click is slightly offset or on a child element
        const node = e.target.closest('.node, .mindmap-node, .cluster, .requirementBox, text, .edgeLabel');
        if (!node) return;

        e.preventDefault();
        activeNodeId = null;

        let current = node;
        while (current && current !== viewer && current.tagName !== 'svg') {
            const targetId = current.id || current.getAttribute('id');
            const text = current.textContent?.trim() || "";
            const cleanText = text.replace(/^["(\[\{]+|[")\]\}]+$/g, '').trim();
            // Allow interaction even if not in idMap. Use found ID or text as the key.
            const foundId = (targetId && targetId !== 'undefined' ? targetId : null) ||
                           (cleanText && cleanText.length < 100 ? cleanText : null);
            
            if (foundId) { activeNodeId = foundId; break; }
            current = current.parentElement;
        }

        if (activeNodeId && activeNodeId !== 'undefined') {
            contextMenu.style.display = 'block';
            contextMenu.style.left = `${e.clientX}px`; contextMenu.style.top = `${e.clientY}px`;
        }
    });

    document.addEventListener('click', (e) => { 
        if (contextMenu && !contextMenu.contains(e.target)) contextMenu.style.display = 'none'; 
    });

    document.getElementById('menu-view-comments').addEventListener('click', () => openCommentOverlay(false));
    document.getElementById('menu-add-comment').addEventListener('click', () => openCommentOverlay(true));
    if (saveCommentBtn) saveCommentBtn.addEventListener('click', saveComment);

    // @foundryspec/start COMP_ClickInterceptor
    // Left-Click Listener (Navigation)
    viewer.addEventListener('click', (e) => {
        let target = e.target;
        if (target.closest('a')) return;
        const nodeContainer = target.closest('.node, .mindmap-node, .cluster, .requirementBox, text, .edgeLabel, .actor, g[name], g[id*="actor"]');
        if (!nodeContainer) return;

        let current = nodeContainer;
        while (current && current !== viewer && current.tagName !== 'svg') {
            const targetId = current.id || current.getAttribute('id') || current.getAttribute('name');
            // Check direct ID or clean ID
            if (targetId) {
                if (idMap[targetId]) { loadDiagram(idMap[targetId]); return; }
                const cleanId = targetId.split('-').find(part => idMap[part]);
                if (cleanId) { loadDiagram(idMap[cleanId]); return; }
            }
            
            // Check Text content
            let text = current.textContent?.trim() || "";
            const cleanText = text.replace(/^["(\[\{]+|[")\]\}]+$/g, '').trim();
            if ((text && idMap[text]) || (cleanText && idMap[cleanText])) {
                const targetPath = idMap[text] || idMap[cleanText];
                loadDiagram(targetPath); return;
            }
            // If we are here, the node is "clickable" visually but has no map.
            // We just stop propagation/don't do anything for navigation to avoid confusion,
            // or perhaps it just selects? The user said "clickable", but if there's no destination...
            // Standard action: do nothing for navigation if no map link. 
            // BUT, we need to ensure we don't block event if it's not a link.
            // Actually, the loop just looks for a valid link.
            
            current = current.parentElement;
        }
    });
    // @foundryspec/end

    backButton.addEventListener('click', () => { if (historyStack.length > 1) { historyStack.pop(); loadDiagram(historyStack.pop()); } });
    injectCustomCSS(); await fetchComments(); startSync(); loadDiagram('assets/root.mermaid');
}

// @foundryspec/start COMP_InteractiveComments
function openCommentOverlay(focusInput) {
    if (contextMenu) contextMenu.style.display = 'none';
    commentList.innerHTML = '';
    const currentUsi = getUSI(activeNodeId, currentViewPath);
    const localComments = commentsRegistry[currentUsi] || [];
    const otherComments = Object.keys(commentsRegistry)
        .filter(key => key.includes(`#${activeNodeId}@`) && key !== currentUsi)
        .reduce((arr, key) => arr.concat(commentsRegistry[key]), []);

    const renderSet = (title, items, isLocal) => {
        if (items.length === 0) return;
        const h3 = document.createElement('h3');
        h3.style.color = isLocal ? '#38bdf8' : '#94a3b8';
        h3.style.fontSize = '0.75rem'; h3.style.margin = '1rem 0 0.5rem 0';
        h3.style.textTransform = 'uppercase'; h3.innerText = title;
        commentList.appendChild(h3);
        items.forEach(c => {
            const header = document.createElement('div'); header.className = 'comment-header';
            header.innerHTML = `<span class="comment-author">${c.author}</span><span style="color: #64748b; font-size: 0.7rem;">${new Date(c.timestamp).toLocaleDateString()}</span>`;
            const textDiv = document.createElement('div'); textDiv.className = 'comment-text';
            textDiv.style.marginBottom = '1rem'; textDiv.textContent = c.content;
            commentList.appendChild(header); commentList.appendChild(textDiv);
        });
    };
    renderSet('Comments in this View', localComments, true);
    renderSet('Comments from other Views', otherComments, false);
    if (localComments.length === 0 && otherComments.length === 0) { commentList.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; margin-bottom: 0.5rem;">No feedback yet.</div>'; }
    if (focusInput && newCommentInput) newCommentInput.focus();
}
// @foundryspec/end COMP_InteractiveComments

// --- Theme & Search ---
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.getElementById('theme-toggle').innerHTML = isDark ? '&#9790;' : '&#9728;';
}

function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('theme-toggle').innerHTML = '&#9790;'; // Moon
    }
}

// Search Logic
const searchInput = document.getElementById('search-input');
if (searchInput) {
    const resultsContainer = document.createElement('div');
    resultsContainer.id = 'search-results';
    resultsContainer.style.cssText = `
        position: absolute; top: 60px; right: 20px; background: white; border: 1px solid #ccc;
        border-radius: 4px; max-height: 300px; overflow-y: auto; width: 300px; z-index: 1000;
        display: none; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    document.getElementById('header').appendChild(resultsContainer);

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        resultsContainer.innerHTML = '';
        if (query.length < 2) { resultsContainer.style.display = 'none'; return; }

        const matches = Object.keys(idMap).filter(k => k.toLowerCase().includes(query) && !k.endsWith('_code'));
        if (matches.length > 0) {
            resultsContainer.style.display = 'block';
            matches.forEach(match => {
                const item = document.createElement('div');
                item.textContent = match;
                item.style.cssText = 'padding: 8px; cursor: pointer; border-bottom: 1px solid #eee; color: #333;';
                item.onmouseover = () => item.style.background = '#f0f9ff';
                item.onmouseout = () => item.style.background = 'transparent';
                item.onclick = () => {
                    const mapped = idMap[match];
                    const target = Array.isArray(mapped) ? mapped[0] : mapped;
                    loadDiagram(target);
                    resultsContainer.style.display = 'none';
                    searchInput.value = '';
                };
                resultsContainer.appendChild(item);
            });
        } else {
            resultsContainer.style.display = 'none';
        }
    });
    
    // Hide search on outside click
    document.addEventListener('click', (e) => {
        if (e.target !== searchInput && e.target !== resultsContainer) {
            resultsContainer.style.display = 'none';
        }
    });
}

// Initialize
initTheme();

async function saveComment() {
    const content = newCommentInput.value.trim();
    if (!content || !activeNodeId || activeNodeId === 'undefined') return;
    const usi = getUSI(activeNodeId, currentViewPath);
    if (!usi) return;
    const newComment = { id: Math.random().toString(36).substr(2, 9), targetId: activeNodeId, viewPath: currentViewPath, author: 'Reviewer', content, timestamp: new Date().toISOString(), status: 'open' };
    if (!commentsRegistry[usi]) commentsRegistry[usi] = [];
    commentsRegistry[usi].push(newComment);
    try {
        const response = await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newComment, compositeKey: usi }) });
        if (!response.ok) throw new Error('Failed to save');
        newCommentInput.value = ''; closeCommentOverlay();
        if (currentContainer) applyCursors(currentContainer);
    } catch (e) { console.error('[FoundrySpec] Failed to sync comment with server.', e); }
}

function closeCommentOverlay() { commentOverlay.style.display = 'none'; }
window.closeCommentOverlay = closeCommentOverlay;

function resolvePath(base, relative) {
    const stack = base.split('/'); const parts = relative.split('/'); stack.pop();
    for (let i = 0; i < parts.length; i++) { if (parts[i] === '.') continue; if (parts[i] === '..') stack.pop(); else stack.push(parts[i]); }
    return stack.join('/');
}

async function loadDiagram(filePath) {
    try {
        const response = await fetch(filePath); if (!response.ok) throw new Error(`File not found: ${filePath}`);
        let content = await response.text(); 
        currentViewPath = filePath.replace(/\\/g, '/');
        content = content.replace(/^---[\s\S]*?---\s*/, '');
        if (filePath.endsWith('.md')) {
            modalTitle.innerText = filePath.split('/').pop(); let html = marked.parse(content);
            const possibleId = Object.keys(idMap).find(k => idMap[k] === filePath);
            if (possibleId && idMap[`${possibleId}_code`]) {
                const codeFiles = idMap[`${possibleId}_code`];
                html += `<div class="implementation-box" style="margin-top: 2rem; padding: 1.5rem; background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 8px;"><h3 style="margin-top: 0; color: #38bdf8; font-family: 'Outfit'; font-size: 1rem;">Implementation Traceability</h3><p style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 1rem;">This requirement is implemented in the following codebase locations:</p><ul style="list-style: none; padding: 0; margin: 0;">${codeFiles.map(f => `<li style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; font-family: monospace; font-size: 0.85rem; color: #f8fafc;"><span style="color: #38bdf8;">📁</span> ${f}</li>`).join('')}</ul></div>`;
            }
            modalBody.innerHTML = html; modalBackdrop.classList.add('open'); return;
        }
        const { svg } = await mermaid.render('mermaid-svg-' + Date.now(), content);
        const newContainer = document.createElement('div'); newContainer.className = 'diagram-container initial'; newContainer.innerHTML = svg;
        const svgEl = newContainer.querySelector('svg'); if (svgEl) { svgEl.style.width = '100%'; svgEl.style.height = '100%'; svgEl.style.maxWidth = 'none'; }
        viewer.appendChild(newContainer); applyCursors(newContainer);
        if (currentContainer) { const oldContainer = currentContainer; oldContainer.classList.add('fade-out'); setTimeout(() => { if (oldContainer.parentNode) oldContainer.parentNode.removeChild(oldContainer); }, 400); }
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                newContainer.classList.remove('initial'); newContainer.classList.add('fade-in');
                if (svgEl) { try { panZoomInstance = svgPanZoom(svgEl, { zoomEnabled: true, controlIconsEnabled: true, fit: true, center: true, minZoom: 0.1 }); } catch (e) {} }
            });
        });

        currentContainer = newContainer; 
        
        // Only push to history if it's a new path
        if (historyStack.length === 0 || historyStack[historyStack.length - 1] !== filePath) {
            historyStack.push(filePath); 
        }
        updateUI();

        if (svgEl) {
            const links = svgEl.querySelectorAll('a');
            links.forEach(link => { link.addEventListener('click', (e) => { e.preventDefault(); const href = link.getAttribute('href') || link.getAttribute('xlink:href'); if (href) { if (href.startsWith('http') || href.startsWith('mailto')) { window.open(href, '_blank'); } else { const resolved = resolvePath(filePath, href); loadDiagram(resolved); } } }); });
        }
    } catch (error) {
        console.error('[FoundrySpec] Error loading diagram:', error);
        const errDiv = document.createElement('div'); errDiv.style.color = '#ef4444'; errDiv.style.padding = '2rem';
        errDiv.style.fontWeight = 'bold'; errDiv.innerText = `Error loading diagram: ${filePath}\n${error.message}`;
        if (viewer) { viewer.innerHTML = ''; viewer.appendChild(errDiv); }
    }
}

function updateUI() { if (backButton) backButton.style.display = historyStack.length > 1 ? 'block' : 'none'; if (breadcrumbs) breadcrumbs.innerHTML = historyStack.map(p => p.split('/').pop()).join(' > '); }
function closeModal(e) { if (e && e.target !== modalBackdrop) return; modalBackdrop.classList.remove('open'); }
window.closeModal = closeModal; initApp();
