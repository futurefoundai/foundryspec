// --- Globals & State ---
let historyStack = [];
let currentContainer = null;
let panZoomInstance = null;
let viewer, backButton, breadcrumbs, modalBackdrop, modalBody, modalTitle;
let navModalBackdrop, navModalBody, navModalTitle;
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
        } catch (e) { /* silent fail for optional css */ }
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

function resolveActiveNodeId(el) {
    let current = el;
    while (current && current !== viewer && current.tagName !== 'svg') {
        const targetId = current.id || current.getAttribute('id') || current.getAttribute('name');
        const text = current.textContent?.trim() || "";
        const cleanText = text.replace(/^["(\[\{]+|[")\]\}]+$/g, '').trim();
        
        const key = (targetId && idMap[targetId] ? targetId : null) || 
                    (idMap[text] ? text : null) || 
                    (idMap[cleanText] ? cleanText : null) ||
                    (targetId && targetId !== 'undefined' ? targetId : null) ||
                    (cleanText.length < 50 ? cleanText : null);

        if (key && key !== 'undefined') return key;
        current = current.parentElement;
    }
    return null;
}

function applyCursors(container) {
    container.querySelectorAll('.node-badge').forEach(b => b.remove());
    const nodes = container.querySelectorAll('.node, .mindmap-node, .cluster, .requirementBox, text, .edgeLabel, .actor, g[id*="actor"], g[name]');
    nodes.forEach(node => {
        const matchingId = resolveActiveNodeId(node);
        if (matchingId) {
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
    const sidebarInput = document.getElementById('sidebar-comment-input');
    const sidebarSaveBtn = document.getElementById('sidebar-save-btn');
    if (sidebarSaveBtn) sidebarSaveBtn.addEventListener('click', () => saveComment(true));
    
    // Navigation Modal
    navModalBackdrop = document.getElementById('nav-modal-backdrop');
    navModalBody = document.getElementById('nav-modal-body');
    navModalTitle = document.getElementById('nav-modal-title');

    const mermaidReady = typeof mermaid !== 'undefined';
    const domReady = !!(backButton && viewer);
    if (!mermaidReady || !domReady) { setTimeout(initApp, 200); return; }

    mermaid.initialize({
        startOnLoad: false, securityLevel: 'loose', theme: 'base',
        themeVariables: { primaryColor: '#1e293b', primaryTextColor: '#f8fafc', primaryBorderColor: '#334155', lineColor: '#38bdf8' }
    });

    // Right-Click Listener (Context Menu)
    viewer.addEventListener('contextmenu', (e) => {
        const node = e.target.closest('.node, .mindmap-node, .cluster, .requirementBox, text, .edgeLabel, .actor, g[name], g[id*="actor"]');
        if (!node) return;

        e.preventDefault();
        activeNodeId = resolveActiveNodeId(node);

        if (activeNodeId) {
            contextMenu.style.display = 'block';
            contextMenu.style.left = `${e.clientX}px`; contextMenu.style.top = `${e.clientY}px`;
        }
    });

    document.addEventListener('click', (e) => { 
        if (contextMenu && !contextMenu.contains(e.target)) contextMenu.style.display = 'none'; 
    });

    document.getElementById('menu-comments').addEventListener('click', (e) => openSidebar(activeNodeId));
    document.getElementById('menu-footnotes').addEventListener('click', (e) => handleFootnoteSelection(activeNodeId, e.clientX, e.clientY));
    document.getElementById('menu-data').addEventListener('click', (e) => openSidebar(activeNodeId));
    document.getElementById('menu-sequence').addEventListener('click', (e) => openSidebar(activeNodeId));
    document.getElementById('menu-flow').addEventListener('click', (e) => openSidebar(activeNodeId));
    document.getElementById('menu-state').addEventListener('click', (e) => openSidebar(activeNodeId));
    
    if (saveCommentBtn) saveCommentBtn.addEventListener('click', saveComment);

    // @foundryspec/start COMP_ClickInterceptor
    // Left-Click Listener (Navigation)
    viewer.addEventListener('click', (e) => {
        let target = e.target;
        if (target.closest('a')) return;
        const nodeContainer = target.closest('.node, .mindmap-node, .cluster, .requirementBox, text, .edgeLabel, .actor, g[name], g[id*="actor"]');
        if (!nodeContainer) return;

        const key = resolveActiveNodeId(nodeContainer);

        if (key && idMap[key]) {
            const rawTargets = idMap[key];
            const targets = Array.isArray(rawTargets) ? rawTargets : [{ path: rawTargets, title: key, type: 'diagram' }];
            
            if (targets.length === 1) {
                loadDiagram(targets[0].path);
            } else {
                openNavigationModal(key, targets);
            }
            return;
        }
    });

    backButton.addEventListener('click', () => { if (historyStack.length > 1) { historyStack.pop(); loadDiagram(historyStack.pop(), true); } });
    injectCustomCSS(); await fetchComments(); startSync(); loadDiagram('assets/root.mermaid');
}

// @foundryspec/start COMP_InteractiveComments
function openCommentOverlay(focusInput, x, y) {
    if (contextMenu) contextMenu.style.display = 'none';
    commentList.innerHTML = '';
    const currentUsi = getUSI(activeNodeId, currentViewPath);
    const localComments = commentsRegistry[currentUsi] || [];
    const otherComments = Object.keys(commentsRegistry)
        .filter(key => key.includes(`#${activeNodeId}@`) && key !== currentUsi)
        .reduce((arr, key) => arr.concat(commentsRegistry[key]), []);

    const renderSet = (title, items, isLocal, usi) => {
        if (items.length === 0) return;
        const h3 = document.createElement('h3');
        h3.style.color = isLocal ? '#38bdf8' : '#94a3b8';
        h3.style.fontSize = '0.75rem'; h3.style.margin = '1rem 0 0.5rem 0';
        h3.style.textTransform = 'uppercase'; h3.innerText = title;
        commentList.appendChild(h3);
        items.forEach(c => {
            const header = document.createElement('div'); header.className = 'comment-header';
            header.innerHTML = `
                <span class="comment-author">${c.author}</span>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="color: #64748b; font-size: 0.7rem;">${new Date(c.timestamp).toLocaleDateString()}</span>
                    ${isLocal ? `<button onclick="resolveComment('${usi}', '${c.id}')" style="background:none; border:none; color:#10b981; cursor:pointer; font-size:1rem; padding:0; display:flex;" title="Resolve & Delete">✓</button>` : ''}
                </div>
            `;
            const textDiv = document.createElement('div'); textDiv.className = 'comment-text';
            textDiv.style.marginBottom = '1rem'; textDiv.textContent = c.content;
            commentList.appendChild(header); commentList.appendChild(textDiv);
        });
    };
    renderSet('Comments in this View', localComments, true, currentUsi);
    renderSet('Comments from other Views', otherComments, false);
    if (localComments.length === 0 && otherComments.length === 0) { commentList.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; margin-bottom: 0.5rem;">No feedback yet.</div>'; }
    
    if (x && y) {
       commentOverlay.style.left = `${x}px`;
       commentOverlay.style.top = `${y}px`;
       commentOverlay.style.position = 'fixed';
    }

    commentOverlay.style.display = 'block';
    if (focusInput && newCommentInput) newCommentInput.focus();
}

async function resolveComment(usi, id) {
    if (!confirm('Resolve and remove this comment?')) return;
    try {
        const response = await fetch('/api/comments/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ compositeKey: usi, id })
        });
        if (response.ok) {
            commentsRegistry[usi] = commentsRegistry[usi].filter(c => c.id !== id);
            if (commentsRegistry[usi].length === 0) delete commentsRegistry[usi];
            
            const sidebar = document.getElementById('context-sidebar');
            if (sidebar && sidebar.classList.contains('open')) {
                renderSidebarContent();
            } else {
                openCommentOverlay();
            }
            
            if (currentContainer) applyCursors(currentContainer);
        }
    } catch (e) { console.error('[FoundrySpec] Failed to resolve comment.', e); }
}
// @foundryspec/end COMP_InteractiveComments

// --- Theme & Search ---
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.getElementById('theme-toggle').innerHTML = isDark ? '&#9790;' : '&#9728;';
}
window.toggleTheme = toggleTheme;

function initTheme() {
    const saved = localStorage.getItem('theme');
    const toggleBtn = document.getElementById('theme-toggle');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (saved === 'dark' || (!saved && systemDark)) {
        document.body.classList.add('dark-mode');
        if (toggleBtn) toggleBtn.innerHTML = '&#9790;'; // Moon
    } else {
        document.body.classList.remove('dark-mode');
        if (toggleBtn) toggleBtn.innerHTML = '&#9728;'; // Sun
    }
}
window.initTheme = initTheme;

// Search Logic
const searchInput = document.getElementById('search-input');
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

        const matches = Object.keys(idMap).filter(k => k.toLowerCase().includes(query));
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
                    const rawTargets = idMap[match];
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
    
    // Hide search on outside click
    document.addEventListener('click', (e) => {
        if (e.target !== searchInput && e.target !== resultsContainer) {
            resultsContainer.style.display = 'none';
        }
    });
}

// Initialize
initTheme();

async function saveComment(fromSidebar = false) {
    const inputEl = fromSidebar ? document.getElementById('sidebar-comment-input') : newCommentInput;
    const content = inputEl.value.trim();
    if (!content || !activeNodeId || activeNodeId === 'undefined') return;
    const usi = getUSI(activeNodeId, currentViewPath);
    if (!usi) return;
    const newComment = { id: Math.random().toString(36).substr(2, 9), targetId: activeNodeId, viewPath: currentViewPath, author: 'Reviewer', content, timestamp: new Date().toISOString(), status: 'open' };
    if (!commentsRegistry[usi]) commentsRegistry[usi] = [];
    commentsRegistry[usi].push(newComment);
    try {
        const response = await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newComment, compositeKey: usi }) });
        if (!response.ok) throw new Error('Failed to save');
        inputEl.value = ''; 
        
        // Refresh UI
        const sidebar = document.getElementById('context-sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            renderSidebarContent();
        } else {
            closeCommentOverlay();
        }
        
        if (currentContainer) applyCursors(currentContainer);
    } catch (e) { console.error('[FoundrySpec] Failed to sync comment with server.', e); }
}

function closeCommentOverlay() { commentOverlay.style.display = 'none'; }
window.closeCommentOverlay = closeCommentOverlay;

function openNavigationModal(title, targets) {
    if (!navModalBackdrop) return;
    navModalTitle.innerText = `Targets for ${title}`;
    navModalBody.innerHTML = '';
    
    // Final defense
    const targetArray = Array.isArray(targets) ? targets : (targets ? [targets] : []);
    
    targetArray.forEach(t => {
        const item = document.createElement('div');
        item.className = 'nav-item';
        const rawTarget = typeof t === 'string' ? { path: t, title: title, type: 'diagram' } : t;
        const icon = getIconForType(rawTarget.type);
        item.innerHTML = `
            <div class="nav-item-icon">${icon}</div>
            <div class="nav-item-content">
                <span class="nav-item-title">${rawTarget.title}</span>
                <span class="nav-item-type">${rawTarget.type}</span>
            </div>
        `;
        item.onclick = () => {
            loadDiagram(rawTarget.path);
            closeNavModal();
        };
        navModalBody.appendChild(item);
    });
    
    navModalBackdrop.classList.add('open');
}

// @foundryspec/start COMP_SidebarControllers
function openSidebar(nodeId) {
    if (contextMenu) contextMenu.style.display = 'none';
    activeNodeId = nodeId;
    
    // UI Update
    const sidebar = document.getElementById('context-sidebar');
    const title = document.getElementById('sidebar-title');
    sidebar.classList.add('open');
    title.innerText = nodeId;

    renderSidebarContent();
}

function closeSidebar() {
    document.getElementById('context-sidebar').classList.remove('open');
}


function handleFootnoteSelection(nodeId, x, y) {
    if (contextMenu) contextMenu.style.display = 'none';
    const targets = (idMap[nodeId] || []).filter(t => t.type === 'footnote' || t.path.endsWith('.md'));
    
    if (targets.length > 0) {
        if (targets.length === 1) {
            // Footnotes stay in modals
            loadDiagram(targets[0].path);
        } else {
            openNavigationModal(`${nodeId} Footnotes`, targets);
        }
    } else {
        // No footnote detected -> Sidebar prompt
        openSidebar(nodeId);
        if (newCommentInput) {
            newCommentInput.value = `[AI PROMPT] This node "${nodeId}" lacks technical documentation. Please generate informative footnotes summarizing its role and implementation details.`;
            newCommentInput.focus();
        }
    }
}

async function renderSidebarContent() {
    const content = document.getElementById('sidebar-content');
    content.innerHTML = '';

    // 1. Related Diagrams (Data, Seq, Flow, State)
    const allTargets = idMap[activeNodeId] || [];
    const related = allTargets.filter(t => ['DATA', 'SEQ', 'FLOW', 'STATE'].some(p => t.type.toUpperCase().startsWith(p)));
    
    if (related.length > 0) {
        const h4 = document.createElement('h4');
        h4.style.fontSize = '0.7rem'; h4.style.textTransform = 'uppercase';
        h4.style.color = 'var(--text-secondary)'; h4.style.margin = '1rem 0 0.5rem 0';
        h4.innerText = 'Related Diagrams';
        content.appendChild(h4);

        related.forEach(t => {
            const item = document.createElement('div');
            item.className = 'design-item';
            item.onclick = () => { closeSidebar(); loadDiagram(t.path); };
            item.innerHTML = `
                <div style="font-size:1.2rem; color:var(--accent)">${t.type.startsWith('DATA') ? '📊' : t.type.startsWith('SEQ') ? '↔️' : t.type.startsWith('STATE') ? '🚦' : '🌲'}</div>
                <div>
                    <div style="font-weight:600; font-size:0.85rem;">${t.title}</div>
                    <div style="font-size:0.7rem; color:var(--text-secondary)">${t.type}</div>
                </div>
            `;
            content.appendChild(item);
        });
        const sep = document.createElement('hr'); sep.style.border = '0'; sep.style.borderTop = '1px solid var(--border)'; sep.style.margin = '1rem 0';
        content.appendChild(sep);
    }

    // 2. Comments
    const usi = getUSI(activeNodeId, currentViewPath);
    const localComments = commentsRegistry[usi] || [];
    const otherComments = Object.keys(commentsRegistry)
        .filter(key => key.includes(`#${activeNodeId}@`) && key !== usi)
        .reduce((arr, key) => arr.concat(commentsRegistry[key]), []);

    const renderBatch = (title, items, isLocal, u) => {
        if (items.length === 0) return;
        const h4 = document.createElement('h4');
        h4.style.fontSize = '0.7rem'; h4.style.textTransform = 'uppercase';
        h4.style.color = isLocal ? 'var(--accent)' : 'var(--text-secondary)';
        h4.style.margin = '1rem 0 0.5rem 0'; h4.innerText = title;
        content.appendChild(h4);

        items.forEach(c => {
            const card = document.createElement('div');
            card.className = 'comment-text';
            card.innerHTML = `
                <div class="comment-header">
                    <span class="comment-author">${c.author}</span>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <span style="font-size:0.65rem; color:var(--text-secondary)">${new Date(c.timestamp).toLocaleDateString()}</span>
                        ${isLocal ? `<button onclick="resolveComment('${u}', '${c.id}')" style="background:none; border:none; color:#10b981; cursor:pointer; font-size:1rem; padding:0; display:flex;">✓</button>` : ''}
                    </div>
                </div>
                <div>${c.content}</div>
            `;
            content.appendChild(card);
        });
    };

    renderBatch('Comments', localComments, true, usi);
    renderBatch('Other Contexts', otherComments, false);

    // 3. AI Prompts (Collapsed by default or just listed?)
    // Let's list them cleanly at bottom
    const aiContainer = document.createElement('div');
    aiContainer.style.marginTop = '1rem';
    
    const aiTitle = document.createElement('h4');
    aiTitle.style.fontSize = '0.7rem'; aiTitle.style.textTransform = 'uppercase';
    aiTitle.style.color = 'var(--text-secondary)'; aiTitle.style.marginBottom = '0.5rem';
    aiTitle.innerText = 'AI Generation';
    aiContainer.appendChild(aiTitle);

    const prompts = {
        DATA: `[AI PROMPT] Generate a DATA_ model for node ${activeNodeId}. Use erDiagram syntax.`,
        SEQ: `[AI PROMPT] Generate a SEQ_ diagram for node ${activeNodeId}. Use sequenceDiagram syntax.`,
        FLOW: `[AI PROMPT] Generate a FLOW_ flowchart for node ${activeNodeId}.`,
        STATE: `[AI PROMPT] Generate a STATE_ state diagram for node ${activeNodeId}.`
    };

    Object.keys(prompts).forEach(key => {
        const promptBox = document.createElement('div');
        promptBox.className = 'ai-prompt-box';
        promptBox.innerHTML = `
            <div class="ai-prompt-text">${prompts[key]}</div>
            <button onclick="copyPrompt('${prompts[key]}')" style="background:var(--accent); color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:0.7rem; cursor:pointer;">Copy</button>
        `;
        aiContainer.appendChild(promptBox);
    });
    content.appendChild(aiContainer);
    
    // Ensure footer is visible
    const footer = document.getElementById('sidebar-footer');
    if (footer) footer.style.display = 'block';
}

function copyPrompt(text) {
    navigator.clipboard.writeText(text);
    alert('Prompt copied to clipboard! Paste it into the comments to request generation.');
}
// @foundryspec/end COMP_SidebarControllers

function closeNavModal(e) {
    if (e && e.target !== navModalBackdrop) return;
    if (navModalBackdrop) navModalBackdrop.classList.remove('open');
}
window.closeNavModal = closeNavModal;

function getIconForType(type) {
    const icons = {
        COMP: '📦', BND: '🌐', CTX: '📐', REQ: '✅', 
        DATA: '💾', SEQ: '🔄', FLOW: '📊', CODE: '💻', PER: '👤', STATE: '🚦'
    };
    return icons[type] || '📄';
}

function resolvePath(base, relative) {
    const stack = base.split('/'); const parts = relative.split('/'); stack.pop();
    for (let i = 0; i < parts.length; i++) { if (parts[i] === '.') continue; if (parts[i] === '..') stack.pop(); else stack.push(parts[i]); }
    return stack.join('/');
}

async function loadDiagram(filePath, isBack = false) {
    try {
        const response = await fetch(filePath); if (!response.ok) throw new Error(`File not found: ${filePath}`);
        let content = await response.text(); 
        currentViewPath = filePath.replace(/\\/g, '/');
        content = content.replace(/^---[\s\S]*?---\s*/, '');
        if (filePath.endsWith('.md')) {
            modalTitle.innerText = filePath.split('/').pop().replace(/\.(mermaid|md)$/, "");
            let html = marked.parse(content);
            
            // Find the ID associated with this file path
            const possibleId = Object.keys(idMap).find(id => 
                idMap[id].some(target => target.path === filePath)
            );

            if (possibleId) {
                const codeFiles = idMap[possibleId]
                   .filter(t => t.type === 'code')
                   .map(t => t.path);

                if (codeFiles.length > 0) {
                   html += `<div class="implementation-box" style="margin-top: 2rem; padding: 1.5rem; background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 8px;"><h3 style="margin-top: 0; color: #38bdf8; font-family: 'Outfit'; font-size: 1rem;">Implementation Traceability</h3><p style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 1rem;">This requirement is implemented in the following codebase locations:</p><ul style="list-style: none; padding: 0; margin: 0;">${codeFiles.map(f => `<li style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; font-family: monospace; font-size: 0.85rem; color: var(--text-primary);"><span style="color: #38bdf8;">📁</span> ${f}</li>`).join('')}</ul></div>`;
                }
            }
            modalBody.innerHTML = html; modalBackdrop.classList.add('open'); return;
        }
        const { svg } = await mermaid.render('mermaid-svg-' + Date.now(), content);
        const newContainer = document.createElement('div'); newContainer.className = 'diagram-container ' + (isBack ? 'initial-reverse' : 'initial'); newContainer.innerHTML = svg;
        const svgEl = newContainer.querySelector('svg'); if (svgEl) { svgEl.style.width = '100%'; svgEl.style.height = '100%'; svgEl.style.maxWidth = 'none'; }
        viewer.appendChild(newContainer); applyCursors(newContainer);
        if (currentContainer) { 
            const oldContainer = currentContainer; 
            oldContainer.classList.add(isBack ? 'fade-out-reverse' : 'fade-out'); 
            setTimeout(() => { 
                if (oldContainer.parentNode) oldContainer.parentNode.removeChild(oldContainer); 
            }, 800); 
        }
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                newContainer.classList.remove(isBack ? 'initial-reverse' : 'initial'); newContainer.classList.add('fade-in');
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

function updateUI() { 
    if (backButton) backButton.style.display = historyStack.length > 1 ? 'block' : 'none'; 
    if (breadcrumbs) {
        breadcrumbs.innerHTML = '';
        historyStack.forEach((path, index) => {
            const span = document.createElement('span');
            span.className = 'breadcrumb-item';
            span.innerText = path.split('/').pop().replace(/\.(mermaid|md)$/, "");
            span.style.cursor = index < historyStack.length - 1 ? 'pointer' : 'default';
            span.style.color = index === historyStack.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)';
            span.style.fontWeight = index === historyStack.length - 1 ? '600' : '400';
            
            if (index < historyStack.length - 1) {
                span.onmouseover = () => span.style.color = 'var(--accent)';
                span.onmouseout = () => span.style.color = 'var(--text-secondary)';
                span.onclick = () => {
                    const stepsToPop = historyStack.length - 1 - index;
                    for (let i = 0; i < stepsToPop; i++) historyStack.pop();
                    loadDiagram(historyStack.pop(), true);
                };
            }
            
            breadcrumbs.appendChild(span);
            if (index < historyStack.length - 1) {
                const sep = document.createElement('span');
                sep.innerText = ' > ';
                sep.style.padding = '0 0.5rem';
                sep.style.color = 'var(--border)';
                sep.style.opacity = '0.5';
                breadcrumbs.appendChild(sep);
            }
        });
    }
}
function closeModal(e) { if (e && e.target !== modalBackdrop) return; modalBackdrop.classList.remove('open'); }
window.closeModal = closeModal; initApp();
