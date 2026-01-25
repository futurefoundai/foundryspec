import { activeNodeId, setActiveNodeId, commentsRegistry, currentViewPath, globals, historyStack } from './state.js';
import { getUSI, getIconForType } from './utils.js';

let loadDiagramFn = null;
export function setLoadDiagramFn(fn) { loadDiagramFn = fn; }

// --- Modals ---
export function closeModal(e) {
    const modalBackdrop = document.getElementById('modal-backdrop');
    if (e && e.target !== modalBackdrop) return;
    if (modalBackdrop) modalBackdrop.classList.remove('open');
}

export function closeNavModal(e) {
    const navModalBackdrop = document.getElementById('nav-modal-backdrop');
    if (e && e.target !== navModalBackdrop) return;
    if (navModalBackdrop) navModalBackdrop.classList.remove('open');
}

export function openNavigationModal(title, targets) {
    const navModalBackdrop = document.getElementById('nav-modal-backdrop');
    const navModalTitle = document.getElementById('nav-modal-title');
    const navModalBody = document.getElementById('nav-modal-body');

    if (!navModalBackdrop) return;
    navModalTitle.innerText = `Targets for ${title}`;
    navModalBody.innerHTML = '';
    
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
            if (loadDiagramFn) loadDiagramFn(rawTarget.path);
            closeNavModal();
        };
        navModalBody.appendChild(item);
    });
    
    navModalBackdrop.classList.add('open');
}

// --- Sidebars ---
/**
 * @foundryspec COMP_SidebarControllers
 */
export function closeSidebar() {
    const sidebar = document.getElementById('context-sidebar');
    if (sidebar) sidebar.classList.remove('open');
}

export function closeFootnoteSidebar() {
    const sidebar = document.getElementById('footnote-sidebar');
    if (sidebar) sidebar.classList.remove('open');
}

export function openSidebar(nodeId) {
    const contextMenu = document.getElementById('context-menu');
    if (contextMenu) contextMenu.style.display = 'none';
    closeFootnoteSidebar();
    setActiveNodeId(nodeId);
    
    const sidebar = document.getElementById('context-sidebar');
    const title = document.getElementById('sidebar-title');
    sidebar.classList.add('open');
    title.innerText = nodeId;

    renderSidebarContent();
}

export function renderSidebarContent() {
    const content = document.getElementById('sidebar-content');
    content.innerHTML = '';
    
    if (!activeNodeId) return;

    // 1. Comments
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

    // 2. AI Prompts
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
            <button onclick="appendPrompt('${prompts[key]}')" style="background:var(--accent); color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:0.7rem; cursor:pointer;">Add</button>
        `;
        aiContainer.appendChild(promptBox);
    });
    content.appendChild(aiContainer);
    
    const footer = document.getElementById('sidebar-footer');
    if (footer) footer.style.display = 'block';
}

export function handleFootnoteSelection(nodeId) {
    const contextMenu = document.getElementById('context-menu');
    if (contextMenu) contextMenu.style.display = 'none';
    const targets = (globals.idMap[nodeId] || []).filter(t => t.type === 'footnote' || t.path.endsWith('.md'));
    
    if (targets.length > 0) {
        if (targets.length === 1) {
             if (loadDiagramFn) loadDiagramFn(targets[0].path);
        } else {
            openNavigationModal(`${nodeId} Footnotes`, targets);
        }
    } else {
        openSidebar(nodeId);
        const newCommentInput = document.getElementById('new-comment-input');
        if (newCommentInput) {
            newCommentInput.value = `[AI PROMPT] This node "${nodeId}" lacks technical documentation. Please generate informative footnotes summarizing its role and implementation details.`;
            newCommentInput.focus();
        }
    }
}

export function openFootnoteSidebar(filePath, content) {
    closeSidebar();
    const sidebar = document.getElementById('footnote-sidebar');
    const title = document.getElementById('footnote-sidebar-title');
    const body = document.getElementById('footnote-sidebar-content');
    
    if (!sidebar || !title || !body) return;

    title.innerText = filePath.split('/').pop().replace(/\.(mermaid|md)$/, "");
    let html = globals.marked.parse(content);
    
    if (globals.idMap) {
        const possibleId = Object.keys(globals.idMap).find(id => 
            globals.idMap[id].some(target => target.path === filePath)
        );
        if (possibleId) {
            const codeFiles = globals.idMap[possibleId]
               .filter(t => t.type === 'code')
               .map(t => t.path);
            if (codeFiles.length > 0) {
               html += `<div class="implementation-box" style="margin-top:2rem;padding:1.5rem;background:rgba(56,189,248,0.05);border:1px solid rgba(56,189,248,0.2);border-radius:8px;"><h3 style="margin-top:0;color:#38bdf8;font-family:'Outfit';font-size:1rem;">Implementation Traceability</h3><p style="font-size:0.9rem;color:#94a3b8;margin-bottom:1rem;">This requirement is implemented in:</p><ul style="list-style:none;padding:0;margin:0;">${codeFiles.map(f => `<li style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;font-family:monospace;font-size:0.85rem;color:var(--text-primary);"><span style="color:#38bdf8;">📁</span> ${f}</li>`).join('')}</ul></div>`;
            }
        }
    }
    
    body.innerHTML = html;
    sidebar.classList.add('open');
}

export function openCommentOverlay(focusInput, x, y) {
    const contextMenu = document.getElementById('context-menu');
    if (contextMenu) contextMenu.style.display = 'none';
    const commentList = document.getElementById('comment-list');
    const commentOverlay = document.getElementById('comment-overlay');
    const newCommentInput = document.getElementById('new-comment-input');
    
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

export function closeCommentOverlay() { 
    const commentOverlay = document.getElementById('comment-overlay');
    if (commentOverlay) commentOverlay.style.display = 'none'; 
}

export function updateUI() {
    // 1. Back Button Visibility
    const backButton = document.getElementById('back-button');
    if (backButton) {
        if (historyStack.length > 1) {
            backButton.style.display = 'block';
            backButton.style.visibility = 'visible';
        } else {
            backButton.style.display = 'none';
        }
    }

    // 2. Breadcrumbs
    const breadcrumbs = document.getElementById('breadcrumbs');
    if (breadcrumbs) {
        breadcrumbs.innerHTML = '';
        historyStack.forEach((path, index) => {
            const isLast = index === historyStack.length - 1;
            const span = document.createElement('span');
            
            // Try to resolve title
            let title = path.split('/').pop().replace(/\.(mermaid|md)$/, "");
            if (globals.idMap) {
               // Find key for this path
               const key = Object.keys(globals.idMap).find(k => {
                   const targets = globals.idMap[k];
                   if (Array.isArray(targets)) return targets.some(t => t.path === path);
                   return targets === path || (targets.path && targets.path === path);
               });
               if (key) title = key;
               else if (path === 'assets/root.mermaid') title = globals.projectName || 'Home';
            }

            if (isLast) {
                span.className = 'breadcrumb-active';
                span.textContent = title;
            } else {
                span.className = 'breadcrumb-link';
                span.textContent = title;
                span.onclick = () => {
                   if (loadDiagramFn) {
                       // Truncate history up to this point (exclusive, so we can re-push or just keep it)
                       // Strategy: We want the stack to end with this path.
                       // Option A: length = index. Then loadDiagram(path) pushes it back.
                       // This ensures checks in loadDiagram run.
                       historyStack.length = index;
                       loadDiagramFn(path);
                   }
                };
            }
            
            breadcrumbs.appendChild(span);
            if (!isLast) {
                const sep = document.createElement('span');
                sep.className = 'breadcrumb-separator';
                sep.textContent = ' > ';
                breadcrumbs.appendChild(sep);
            }
        });
    }
}

// Expose globals for HTML handlers
window.closeModal = closeModal;
window.closeNavModal = closeNavModal;
window.closeSidebar = closeSidebar;
window.openSidebar = openSidebar;
window.handleFootnoteSelection = handleFootnoteSelection;
window.closeFootnoteSidebar = closeFootnoteSidebar;
window.renderSidebarContent = renderSidebarContent;
window.openNavigationModal = openNavigationModal;
window.openCommentOverlay = openCommentOverlay;
window.closeCommentOverlay = closeCommentOverlay;

export function appendPrompt(text) {
    const input = document.getElementById('sidebar-comment-input');
    if (input) {
        const current = input.value;
        input.value = current ? current + '\n' + text : text;
        input.focus();
        input.scrollTop = input.scrollHeight;
    }
}
window.appendPrompt = appendPrompt;
