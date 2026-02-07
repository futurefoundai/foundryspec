
let worksRegistry = [];
let activeWorkId = null;

export async function fetchWorks() {
    try {
        const resp = await fetch('foundry.works.json?t=' + Date.now());
        if (resp.ok) {
            worksRegistry = await resp.json();
            renderWorksList();
        } else {
            worksRegistry = [];
             renderWorksList();
        }
    } catch { 
        console.warn('[FoundrySpec] Could not load works registry.'); 
        worksRegistry = [];
        renderWorksList();
    }
}

export function getWorksRegistry() {
    return worksRegistry;
}

export function openWorksSidebar() {
    const sidebar = document.getElementById('works-sidebar');
    if (sidebar) {
        sidebar.classList.add('open');
        fetchWorks(); // Refresh on open
    }
}

export function closeWorksSidebar() {
    const sidebar = document.getElementById('works-sidebar');
    if (sidebar) sidebar.classList.remove('open');
    activeWorkId = null;
    renderWorksList(); // Reset to list view
}

function renderWorksList() {
    const container = document.getElementById('works-sidebar-content');
    if (!container) return;

    // Filter logic if needed, but for now show all (or default to unresolved)
    // Plan said default unresolved.
    const unresolved = worksRegistry.filter(w => w.status !== 'done');
    const done = worksRegistry.filter(w => w.status === 'done');

    let html = '<div class="works-list">';
    
    // Header / Controls
    html += `
        <div class="works-controls" style="padding: 10px; border-bottom: 1px solid var(--border);">
            <button id="create-work-btn" style="width:100%; padding: 8px; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer;">+ New Work</button>
            <div style="margin-top: 10px; font-size: 0.8rem; display: flex; gap: 10px;">
                <label><input type="checkbox" id="show-done-works"> Show Resolved</label>
            </div>
        </div>
        <div id="works-list-items">
            ${renderWorkItems(unresolved)}
        </div>
    `;
    
    html += '</div>';
    container.innerHTML = html;

    // Events
    document.getElementById('create-work-btn').onclick = () => renderCreateWorkForm();
    
    const toggle = document.getElementById('show-done-works');
    if (toggle) {
        toggle.onchange = (e) => {
            const list = document.getElementById('works-list-items');
            if (e.target.checked) {
                list.innerHTML = renderWorkItems([...unresolved, ...done].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
            } else {
                list.innerHTML = renderWorkItems(unresolved);
            }
        };
    }
}

function renderWorkItems(works) {
    if (works.length === 0) return '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">No works found.</div>';
    
    return works.map(w => `
        <div class="work-item" onclick="window.viewWork('${w.id}')" style="padding: 10px; border-bottom: 1px solid var(--border); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
            <div style="overflow: hidden;">
                <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${w.title}</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">${new Date(w.createdAt).toLocaleDateString()} &middot; ${w.messages.length} msgs</div>
            </div>
            <div class="status-badge ${w.status}" style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: ${w.status === 'done' ? 'var(--green-bg, #dcfce7)' : 'var(--blue-bg, #dbeafe)'}; color: ${w.status === 'done' ? 'var(--green-text, #166534)' : 'var(--blue-text, #1e40af)'};">
                ${w.status.toUpperCase()}
            </div>
        </div>
    `).join('');
}

export function viewWork(id) {
    activeWorkId = id;
    const work = worksRegistry.find(w => w.id === id);
    if (!work) return;

    const container = document.getElementById('works-sidebar-content');
    if (!container) return;

    let html = `
        <div class="work-detail" style="display: flex; flex-direction: column; height: 100%;">
            <div class="work-header" style="padding: 10px; border-bottom: 1px solid var(--border); background: var(--bg-secondary);">
                <button onclick="window.renderWorksList()" style="background:none; border:none; cursor:pointer; margin-right: 10px;">&larr; Back</button>
                <span style="font-weight: 600;">${work.title}</span>
                <div style="margin-top: 5px; font-size: 0.8rem; color: var(--text-secondary);">ID: ${work.id}</div>
            </div>
            <div class="work-messages" id="work-messages" style="flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 10px;">
                ${work.messages.map(msgRender).join('')}
            </div>
            <div class="work-footer" style="padding: 10px; border-top: 1px solid var(--border);">
                ${work.status === 'open' ? `
                    <textarea id="work-reply-input" placeholder="Type a reply..." rows="2" style="width: 100%; border: 1px solid var(--border); padding: 5px; border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);"></textarea>
                    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 5px;">
                         <button onclick="window.resolveWork('${work.id}')" style="background: transparent; border: 1px solid var(--border); color: var(--text-secondary); padding: 5px 10px; border-radius: 4px; cursor: pointer;">Resolve</button>
                         <button onclick="window.postWorkReply('${work.id}')" style="background: var(--accent); color: white; border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer;">Reply</button>
                    </div>
                ` : `
                    <div style="text-align: center; color: var(--text-secondary); padding: 5px;">This work is resolved.</div>
                `}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Scroll to bottom
    const msgContainer = document.getElementById('work-messages');
    if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
}

function msgRender(msg) {
    const isAi = msg.author.toLowerCase().includes('ai') || msg.author === 'system';
    const align = isAi ? 'align-items: flex-start;' : 'align-items: flex-end;';
    const bg = isAi ? 'background: var(--bg-secondary); border: 1px solid var(--border);' : 'background: var(--accent-light, #e0f2fe); color: var(--text-primary);'; // adjust colors later
    
    return `
        <div style="display: flex; flex-direction: column; ${align}">
            <div style="max-width: 85%; padding: 8px; border-radius: 8px; ${bg} font-size: 0.9rem;">
                <div style="font-weight: 600; font-size: 0.75rem; margin-bottom: 2px; opacity: 0.8;">${msg.author}</div>
                <div>${msg.content}</div>
            </div>
            <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 2px;">${new Date(msg.timestamp).toLocaleTimeString()}</div>
        </div>
    `;
}

function renderCreateWorkForm() {
    const container = document.getElementById('works-sidebar-content');
    if (!container) return;

    container.innerHTML = `
        <div style="padding: 10px;">
            <button onclick="window.renderWorksList()" style="background:none; border:none; cursor:pointer; margin-bottom: 10px;">&larr; Cancel</button>
            <h3>Create New Work</h3>
            <div style="margin-bottom: 10px;">
                <label style="display:block; margin-bottom:5px;">Title</label>
                <input type="text" id="new-work-title" style="width:100%; padding: 8px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display:block; margin-bottom:5px;">Checklist / details (initial message)</label>
                <textarea id="new-work-content" rows="4" style="width:100%; padding: 8px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);"></textarea>
            </div>
            <button onclick="window.createWork()" style="width:100%; padding: 10px; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer;">Create Work</button>
        </div>
    `;
}

export async function createWork() {
    const title = document.getElementById('new-work-title').value.trim();
    const content = document.getElementById('new-work-content').value.trim();
    
    if (!title || !content) return; // Simple validation

    const newWork = {
        id: 'work-' + Math.random().toString(36).substr(2, 9),
        title,
        status: 'open',
        createdAt: new Date().toISOString(),
        messages: [
            {
                id: Math.random().toString(36).substr(2, 9),
                author: 'User', // TODO: Get actual user if available
                content,
                timestamp: new Date().toISOString()
            }
        ]
    };

    try {
        const resp = await fetch('/api/works', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newWork)
        });
        
        if (resp.ok) {
            await fetchWorks();
            viewWork(newWork.id);
        }
    } catch (e) { console.error(e); }
}

export async function postWorkReply(workId) {
    const input = document.getElementById('work-reply-input');
    const content = input.value.trim();
    if (!content) return;

    // We need to fetch current work to append? Or sends whole object?
    // API logic in DevServer assumes payload updates/overwrites if ID matches.
    // So we need to get the current work, append message, and send it back.
    // This is not atomic but fine for MVP.
    
    const work = worksRegistry.find(w => w.id === workId);
    if (!work) return;

    work.messages.push({
        id: Math.random().toString(36).substr(2, 9),
        author: 'User', 
        content,
        timestamp: new Date().toISOString()
    });

    try {
        const resp = await fetch('/api/works', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(work)
        });
        
        if (resp.ok) {
            input.value = '';
            viewWork(workId); // Refresh view
            await fetchWorks(); // Update registry
        }
    } catch (e) { console.error(e); }
}

export async function resolveWork(workId) {
    if (!confirm('Mark this work as done?')) return;
    
    try {
        const resp = await fetch('/api/works/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: workId })
        });
        
        if (resp.ok) {
            await fetchWorks();
            // Go back to list?
            renderWorksList();
        }
    } catch (e) { console.error(e); }
}

// Expose to window for HTML event handlers in innerHTML
window.renderWorksList = renderWorksList;
window.viewWork = viewWork;
window.createWork = createWork;
window.postWorkReply = postWorkReply;
window.resolveWork = resolveWork;
