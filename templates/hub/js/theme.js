export function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.innerHTML = isDark ? '&#9790;' : '&#9728;';
}

export function initTheme() {
    const saved = localStorage.getItem('theme');
    const toggleBtn = document.getElementById('theme-toggle');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (saved === 'dark' || (!saved && systemDark)) {
        document.body.classList.add('dark-mode');
        if (toggleBtn) toggleBtn.innerHTML = '&#9790;';
    } else {
        document.body.classList.remove('dark-mode');
        if (toggleBtn) toggleBtn.innerHTML = '&#9728;';
    }
}

// Expose to window for onclick
window.toggleTheme = toggleTheme;
