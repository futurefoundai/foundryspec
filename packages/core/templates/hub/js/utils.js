import { globals } from './state.js';

export function getUSI(nodeId, viewPath) {
    if (!nodeId || nodeId === 'undefined') return null;
    const safeProjectId = (typeof globals.projectId !== 'undefined' && !globals.projectId.startsWith('{{')) ? globals.projectId : 'local-dev';
    return `${safeProjectId}#${nodeId}@${viewPath}`;
}

export function resolvePath(base, relative) {
    const stack = base.split('/'); const parts = relative.split('/'); stack.pop();
    for (let i = 0; i < parts.length; i++) { if (parts[i] === '.') continue; if (parts[i] === '..') stack.pop(); else stack.push(parts[i]); }
    return stack.join('/');
}

export function getIconForType(type) {
    const icons = {
        COMP: '📦', BND: '🌐', CTX: '📐', REQ: '✅', 
        DATA: '💾', SEQ: '🔄', FLOW: '📊', CODE: '💻', PER: '👤', STATE: '🚦'
    };
    return icons[type] || '📄';
}

export function resolveActiveNodeId(el, viewerElement, idMap, viewPath) {
    let current = el;
    while (current && current !== viewerElement && current.tagName !== 'svg') {
        const targetId = current.id || current.getAttribute('id') || current.getAttribute('name');
        const text = current.textContent?.trim() || "";
        const cleanText = text.replace(/^["([{|]+|[")\]}]+$/g, '').trim();
        
        // 1. Precise Mindmap Lookup (Build-time mapping of Text -> ID)
        if (viewPath && globals.mindmapRegistry && globals.mindmapRegistry[viewPath]) {
            const pathMap = globals.mindmapRegistry[viewPath];
            if (pathMap[cleanText]) return pathMap[cleanText];
            if (pathMap[text]) return pathMap[text];
        }

        // 2. Global idMap (IDs or Title matches)
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
