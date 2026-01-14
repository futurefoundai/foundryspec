// --- Globals & State ---
let historyStack = [];
let currentContainer = null;
let panZoomInstance = null;
let viewer, backButton, breadcrumbs, modalBackdrop, modalBody, modalTitle;

// --- Auto-CSS Injector ---
async function injectCustomCSS() {
    const cssFiles = ['assets/theme.css', 'assets/custom.css'];
    for (const file of cssFiles) {
        try {
            const resp = await fetch(file, { method: 'HEAD' });
            if (resp.ok) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = file;
                document.head.appendChild(link);
            }
        } catch (e) {}
    }
}

function applyCursors(container) {
    const nodes = container.querySelectorAll('.nodes .node, .cluster, .mindmap-node, text, .requirementBox, .edgeLabel');
    nodes.forEach(node => {
        let text = node.textContent?.trim() || "";
        const id = node.id || node.getAttribute('id');
        
        // --- Robust Normalization ---
        // Strip Mermaid shape markers: (text), ((text)), [text], [[text]], {{text}}
        const cleanText = text.replace(/^[\(\[\{]+|[\)\]\}]+$/g, '').trim();
        
        let isClickable = (text && idMap[text]) || (id && idMap[id]) || (cleanText && idMap[cleanText]);
        
        if (!isClickable && id) {
            const cleanId = id.split('-').find(part => idMap[part]);
            if (cleanId) isClickable = true;
        }

        if (!isClickable) {
            const possibleMatch = Array.from(node.childNodes)
                .filter(n => n.nodeType === 3 || n.tagName === 'text' || n.tagName === 'tspan')
                .map(n => n.textContent?.trim())
                .find(t => {
                    if (!t) return false;
                    const ct = t.replace(/^[\(\[\{]+|[\)\]\}]+$/g, '').trim();
                    return idMap[t] || idMap[ct];
                });
            if (possibleMatch) isClickable = true;
        }

        if (isClickable || node.closest('a')) {
            node.classList.add('clickable-node');
        }
    });
}

async function initApp() {
    // Select Elements
    viewer = document.getElementById('viewer');
    backButton = document.getElementById('back-button');
    breadcrumbs = document.getElementById('breadcrumbs');
    modalBackdrop = document.getElementById('modal-backdrop');
    modalBody = document.getElementById('modal-body');
    modalTitle = document.getElementById('modal-title');
    currentContainer = document.getElementById('diagram-container');

    const mermaidReady = typeof mermaid !== 'undefined';
    const domReady = !!(backButton && viewer);

    if (!mermaidReady || !domReady) {
        setTimeout(initApp, 200);
        return;
    }

    // Initialize Mermaid
    mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'base',
        themeVariables: {
            primaryColor: '#1e293b',
            primaryTextColor: '#f8fafc',
            primaryBorderColor: '#334155',
            lineColor: '#38bdf8',
            secondaryColor: '#0f172a',
            tertiaryColor: '#1e293b',
            fontSize: '14px',
            fontWeight: '700'
        },
        themeCSS: `
            .requirementBox { fill: #0f172a !important; stroke: #38bdf8 !important; stroke-width: 2px !important; }
            .requirementTitle { fill: #38bdf8 !important; font-weight: 800 !important; font-family: 'Outfit' !important; }
            .requirementBodyText, .reqId, .reqText, .reqRisk, .reqMethod { fill: #f8fafc !important; font-family: 'Inter' !important; }
            .relation { stroke: #94a3b8 !important; stroke-width: 1.5px !important; }
        `,
        flowchart: { useMaxWidth: false, htmlLabels: true, curve: 'basis' }
    });

    // Smart Interceptor: Generic Click Handler for SVGs
    viewer.addEventListener('click', (e) => {
        let target = e.target;

        // If it's already a link, let Mermaid handle it natively
        if (target.closest('a')) return;

        // Find the nearest logical node container
        const nodeContainer = target.closest('.node, .mindmap-node, .cluster, .requirementBox, text, .edgeLabel');
        if (!nodeContainer) return;

        let current = nodeContainer;
        while (current && current !== viewer && current.tagName !== 'svg') {
            // 1. Check ID-based match (Priority)
            const targetId = current.id || current.getAttribute('id');
            if (targetId) {
                // Check raw ID
                if (idMap[targetId]) {
                    loadDiagram(idMap[targetId]);
                    return;
                }
                // Check clean ID (handling Mermaid prefixes)
                const cleanId = targetId.split('-').find(part => idMap[part]);
                if (cleanId) {
                    loadDiagram(idMap[cleanId]);
                    return;
                }
            }

            // 2. Check Text-based match
            // We only check text if this is a leaf element or a recognized node container
            let text = current.textContent?.trim() || "";
            const cleanText = text.replace(/^[\(\[\{]+|[\)\]\}]+$/g, '').trim();
            
            if ((text && idMap[text]) || (cleanText && idMap[cleanText])) {
                const targetPath = idMap[text] || idMap[cleanText];
                // Verify it's not the entire SVG text (anti-collision)
                if (text.length < 500) { // Safety threshold to avoid matching whole-diagram text
                    loadDiagram(targetPath);
                    return;
                }
            }

            // 3. Fallback: Check direct children for an exact match
            const possibleMatch = Array.from(current.childNodes)
                .filter(n => n.nodeType === 3 || n.tagName === 'text' || n.tagName === 'tspan')
                .map(n => n.textContent?.trim() || "")
                .find(t => {
                    const ct = t.replace(/^[\(\[\{]+|[\)\]\}]+$/g, '').trim();
                    return idMap[t] || idMap[ct];
                });
            
            if (possibleMatch) {
                const ct = possibleMatch.replace(/^[\(\[\{]+|[\)\]\}]+$/g, '').trim();
                loadDiagram(idMap[possibleMatch] || idMap[ct]);
                return;
            }

            current = current.parentElement;
        }
    });

    backButton.addEventListener('click', () => {
        if (historyStack.length > 1) {
            historyStack.pop();
            const previous = historyStack.pop();
            loadDiagram(previous);
        }
    });

    injectCustomCSS();
    loadDiagram('root.mermaid');
}

function resolvePath(base, relative) {
    const stack = base.split('/');
    const parts = relative.split('/');
    stack.pop();
    for (let i = 0; i < parts.length; i++) {
        if (parts[i] === '.') continue;
        if (parts[i] === '..') stack.pop();
        else stack.push(parts[i]);
    }
    return stack.join('/');
}

async function loadDiagram(filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`File not found: ${filePath}`);
        let content = await response.text();

        // More robust frontmatter removal
        content = content.replace(/^---[\s\S]*?---\s*/, '');

        if (filePath.endsWith('.md')) {
            modalTitle.innerText = filePath.split('/').pop();
            
            let html = marked.parse(content);
            
            // Check if this ID (or path) has code implementation mapping
            const fileName = filePath.split('/').pop();
            const possibleId = Object.keys(idMap).find(k => idMap[k] === filePath);
            if (possibleId && idMap[`${possibleId}_code`]) {
                const codeFiles = idMap[`${possibleId}_code`];
                html += `
                    <div class="implementation-box" style="margin-top: 2rem; padding: 1.5rem; background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 8px;">
                        <h3 style="margin-top: 0; color: #38bdf8; font-family: 'Outfit'; font-size: 1rem;">Implementation Traceability</h3>
                        <p style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 1rem;">This requirement is implemented in the following codebase locations:</p>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            ${codeFiles.map(f => `
                                <li style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; font-family: monospace; font-size: 0.85rem; color: #f8fafc;">
                                    <span style="color: #38bdf8;">📁</span> ${f}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `;
            }

            modalBody.innerHTML = html;
            modalBackdrop.classList.add('open');
            return;
        }

        const { svg } = await mermaid.render('mermaid-svg-' + Date.now(), content);

        const newContainer = document.createElement('div');
        newContainer.className = 'diagram-container initial';
        newContainer.innerHTML = svg;

        const svgEl = newContainer.querySelector('svg');
        if (svgEl) {
            svgEl.style.width = '100%';
            svgEl.style.height = '100%';
            svgEl.style.maxWidth = 'none';
        }

        viewer.appendChild(newContainer);
        applyCursors(newContainer);

        if (currentContainer) {
            const oldContainer = currentContainer;
            oldContainer.classList.add('fade-out');
            setTimeout(() => {
                if (oldContainer.parentNode) oldContainer.parentNode.removeChild(oldContainer);
            }, 400);
        }

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                newContainer.classList.remove('initial');
                newContainer.classList.add('fade-in');
                if (svgEl) {
                    try {
                        panZoomInstance = svgPanZoom(svgEl, {
                            zoomEnabled: true,
                            controlIconsEnabled: true,
                            fit: true,
                            center: true,
                            minZoom: 0.1
                        });
                    } catch (e) {
                        // Silent failure
                    }
                }
            });
        });

        currentContainer = newContainer;
        historyStack.push(filePath);
        updateUI();

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
        const errDiv = document.createElement('div');
        errDiv.style.color = '#ef4444';
        errDiv.style.padding = '2rem';
        errDiv.style.fontWeight = 'bold';
        errDiv.innerText = `Error loading diagram: ${filePath}\n${error.message}`;
        if (viewer) {
            viewer.innerHTML = '';
            viewer.appendChild(errDiv);
        }
    }
}

function updateUI() {
    if (backButton) backButton.style.display = historyStack.length > 1 ? 'block' : 'none';
    if (breadcrumbs) breadcrumbs.innerHTML = historyStack.map(p => p.split('/').pop()).join(' > ');
}

function closeModal(e) {
    if (e && e.target !== modalBackdrop) return;
    modalBackdrop.classList.remove('open');
}

window.closeModal = closeModal;
initApp();
