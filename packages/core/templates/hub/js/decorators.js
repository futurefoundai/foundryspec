import { commentsRegistry, currentViewPath, globals } from './state.js';
import { getUSI, resolveActiveNodeId } from './utils.js';

export function injectCommentBadge(node, count, isLocal) {
    try {
        const bbox = node.getBBox();
        if (bbox.width === 0) return;

        const x = bbox.x + bbox.width;
        const y = bbox.y;

        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "node-badge");
        g.style.pointerEvents = "none";
        
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", x); circle.setAttribute("cy", y); circle.setAttribute("r", "8");
        circle.setAttribute("class", isLocal ? "comment-badge local" : "comment-badge");
        circle.style.fill = isLocal ? "#38bdf8" : "#64748b";
        circle.style.stroke = "#0f172a";
        circle.style.pointerEvents = "none";
        
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", x); text.setAttribute("y", y + 3);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("class", "comment-count");
        text.style.fill = "#0f172a"; text.style.fontSize = "10px"; text.style.fontWeight = "bold";
        text.style.pointerEvents = "none";
        text.textContent = count;
        
        g.appendChild(circle); g.appendChild(text);
        node.appendChild(g);
    } catch { /* empty */ }
}

export function applyCursors(container) {
    if (!container) return;
    container.querySelectorAll('.node-badge').forEach(b => b.remove());
    const nodes = container.querySelectorAll('.node, .mindmap-node, .cluster, .requirementBox, text, .edgeLabel, .actor, g[id*="actor"], g[name]');
    nodes.forEach(node => {
        const matchingId = resolveActiveNodeId(node, globals.viewer?.parentElement, globals.idMap); 
        // Note: globals.viewer might be undefined here if not passed. 
        // But resolveActiveNodeId logic uses `viewerElement` to stop traversal. 
        // We can pass `document.getElementById('viewer')` or update utils to accept null.
        
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
