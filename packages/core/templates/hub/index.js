import { initApp } from './js/app.js';

// Start Application
// Ensure DOM is ready (though module scripts defer by default)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
