import { commentsRegistry, currentContainer, lastRegistrySync, setCommentsRegistry, setLastRegistrySync, activeNodeId, currentViewPath } from './state.js';
import { applyCursors } from './decorators.js';
import { renderSidebarContent, closeCommentOverlay, openCommentOverlay } from './ui.js';
import { getUSI } from './utils.js';

/**
 * @foundryspec COMP_InteractiveComments
 */
export async function fetchComments() {
    try {
        const resp = await fetch('assets/foundry.comments.json?t=' + Date.now());
        if (resp.ok) { 
            setCommentsRegistry(await resp.json()); 
            if (currentContainer) applyCursors(currentContainer);
        }
    } catch (_e) { console.warn('[FoundrySpec] Could not load comments registry.'); }
}

export async function startSync() {
    setInterval(async () => {
        try {
            const resp = await fetch('/api/sync');
            if (resp.ok) {
                const { lastModified } = await resp.json();
                if (lastModified > lastRegistrySync) {
                    setLastRegistrySync(lastModified);
                    await fetchComments();
                }
            }
        } catch (_e) { /* empty */ }
    }, 2000);
}

export async function saveComment(fromSidebar = false) {
    const inputEl = fromSidebar ? document.getElementById('sidebar-comment-input') : document.getElementById('new-comment-input');
    const content = inputEl.value.trim();
    if (!content || !activeNodeId || activeNodeId === 'undefined') return;
    const usi = getUSI(activeNodeId, currentViewPath);
    if (!usi) return;
    const newComment = { id: Math.random().toString(36).substr(2, 9), targetId: activeNodeId, viewPath: currentViewPath, author: 'Reviewer', content, timestamp: new Date().toISOString(), status: 'open' };
    
    // Update local state temporarily
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

export async function resolveComment(usi, id) {
    if (!confirm('Resolve and remove this comment?')) return;
    try {
        const response = await fetch('/api/comments/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ compositeKey: usi, id })
        });
        if (response.ok) {
            // Update local registry
            const list = commentsRegistry[usi];
            if (list) {
                const newList = list.filter(c => c.id !== id);
                if (newList.length === 0) delete commentsRegistry[usi];
                else commentsRegistry[usi] = newList;
            }
            
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

// Attach to window for HTML events
window.resolveComment = resolveComment;
