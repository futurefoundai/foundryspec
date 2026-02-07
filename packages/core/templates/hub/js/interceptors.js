
import { currentViewPath, globals } from './state.js';
import { resolveActiveNodeId } from './utils.js';
import { loadDiagram } from './diagram.js';
import { openNavigationModal, resetContextMenu } from './ui.js';

/**
 * @foundryspec COMP_ClickInterceptor
 * @interface ClickInterceptor
 * @method handle(event, element, context)
 */

class NavigationInterceptor {
    canHandle(context) {
        return context.diagramType === 'navigation';
    }

    handle(event, element, context) {
        const nodeGroup = element.closest('.mindmap-node, .node');
        if (!nodeGroup) return false;

        // Resolve ID using standard logic (which includes the registry)
        const viewer = document.getElementById('viewer');
        const resolvedId = resolveActiveNodeId(nodeGroup, viewer, globals.idMap, context.filePath);

        // If clicking the root node of the navigation hub, do nothing
        if (resolvedId === context.diagramId || resolvedId === 'root' || resolvedId === 'ROOT') {
            event.stopImmediatePropagation();
            event.preventDefault();
            return true; 
        }

        if (resolvedId) {
            console.group('%c🚀 Navigation Interceptor', 'color: #00ff00; font-weight: bold;');
            
            // 1. Resolve via Mindmap Registry (Explicit node-level override)
            const registryId = globals.mindmapRegistry?.[context.filePath]?.[element.textContent?.trim()];
            const finalId = registryId || resolvedId;
            
            if (registryId) {
                console.log('✅ Resolved via Mindmap Registry:', registryId);
            }

            // 2. Resolve via Navigation Registry (Build-time best default)
            if (globals.navigationRegistry && globals.navigationRegistry[finalId]) {
                const targetPath = globals.navigationRegistry[finalId];
                console.log(`🚀 Navigation Registry: Jumping to ${targetPath}`);
                console.groupEnd();
                
                event.stopImmediatePropagation();
                event.preventDefault();
                
                loadDiagram(targetPath);
                return true;
            }

            // 3. Fallback to idMap (Show modal if multiple targets remain)
            const primaryTargets = globals.idMap[finalId];
            if (primaryTargets) {
                let targets = Array.isArray(primaryTargets) ? primaryTargets : [{ path: primaryTargets, title: finalId, type: 'diagram' }];
                
                console.log(`[NavigationInterceptor] Fallback to idMap with ${targets.length} targets`);
                
                event.stopImmediatePropagation();
                event.preventDefault();

                if (targets.length === 1) {
                    loadDiagram(targets[0].path);
                } else {
                    openNavigationModal(finalId, targets);
                }
                console.groupEnd();
                return true;
            }
            else {
                // FALLBACK: Only check metadata if idMap is empty
                const metadata = globals.metadataRegistry[resolvedId];
                if (metadata) {
                    const navigationTargets = [];
                    const toArray = (val) => val ? (Array.isArray(val) ? val : [val]) : [];
                    
                    // Add downlinks
                    toArray(metadata.downlinks).forEach(dlId => {
                        if (globals.idMap[dlId]) {
                            const target = Array.isArray(globals.idMap[dlId]) ? globals.idMap[dlId][0] : globals.idMap[dlId];
                            navigationTargets.push({ ...target, title: `${dlId} (downlink)`, id: dlId, category: 'downlink' });
                        }
                    });
                    
                    // Add references (backlinks)
                    toArray(metadata.referencedBy).forEach(refId => {
                        if (globals.idMap[refId]) {
                            const target = Array.isArray(globals.idMap[refId]) ? globals.idMap[refId][0] : globals.idMap[refId];
                            navigationTargets.push({ ...target, title: `${refId} (references this)`, id: refId, category: 'reference' });
                        }
                    });
                    
                    if (navigationTargets.length === 1) {
                        loadDiagram(navigationTargets[0].path);
                    } else if (navigationTargets.length > 1) {
                        openNavigationModal(resolvedId, navigationTargets);
                    }
                }
            }
            console.groupEnd();
        }

        event.stopImmediatePropagation();
        event.preventDefault();
        return true;
    }
}

class MindmapInterceptor {
    canHandle(context) {
        return context.diagramType === 'mindmap' || context.diagramType === 'mermaid-mindmap';
    }

    handle(event, element, context) {
        return handleStandardInterception(event, element, context, '🧠 Mindmap Interceptor', '#00ccff');
    }
}

class PersonaInterceptor {
    canHandle(context) { return context.diagramType === 'personas'; }
    handle(event, element, context) {
        return handleStandardInterception(event, element, context, '👤 Persona Interceptor', '#e91e63');
    }
}

class JourneyInterceptor {
    canHandle(context) { return context.diagramType === 'journeys'; }
    handle(event, element, context) {
        return handleStandardInterception(event, element, context, '🗺️ Journey Interceptor', '#4caf50');
    }
}

class ComponentInterceptor {
    canHandle(context) { return context.diagramType === 'components'; }
    handle(event, element, context) {
        return handleStandardInterception(event, element, context, '📦 Component Interceptor', '#ff9800');
    }
}

class SequenceInterceptor {
    canHandle(context) { return context.diagramType === 'sequences'; }
    handle(event, element, context) {
        return handleStandardInterception(event, element, context, '🔄 Sequence Interceptor', '#2196f3');
    }
}

class DataInterceptor {
    canHandle(context) { return context.diagramType === 'data'; }
    handle(event, element, context) {
        return handleStandardInterception(event, element, context, '💾 Data Interceptor', '#9c27b0');
    }
}

class StateInterceptor {
    canHandle(context) { return context.diagramType === 'states'; }
    handle(event, element, context) {
        return handleStandardInterception(event, element, context, '🚦 State Interceptor', '#f44336');
    }
}

class FlowInterceptor {
    canHandle(context) { return context.diagramType === 'flows'; }
    handle(event, element, context) {
        return handleStandardInterception(event, element, context, '📊 Flow Interceptor', '#00bcd4');
    }
}

class BoundaryInterceptor {
    canHandle(context) { return context.diagramType === 'boundaries'; }
    handle(event, element, context) {
        return handleStandardInterception(event, element, context, '🌐 Boundary Interceptor', '#607d8b');
    }
}

class ContextInterceptor {
    canHandle(context) { return context.diagramType === 'context'; }
    handle(event, element, context) {
        return handleStandardInterception(event, element, context, '📐 Context Interceptor', '#3f51b5');
    }
}

class RequirementInterceptor {
    canHandle(context) { return context.diagramType === 'requirements'; }
    handle(event, element, context) {
        return handleStandardInterception(event, element, context, '✅ Requirement Interceptor', '#8bc34a');
    }
}

class DefaultInterceptor {
    canHandle() {
        return true;
    }

    handle(event, element, context) {
        // CHECK FOR BADGE CLICK
        if (element.classList.contains('clickable-badge')) {
           const nodeGroup = element.closest('.node, .cluster, .actor, .requirementBox') || element.parentElement; // Fallback
           const viewer = document.getElementById('viewer');
           const resolvedId = resolveActiveNodeId(nodeGroup, viewer, globals.idMap, context.filePath);
           
           console.log('🔘 Comment Badge Clicked (Default) on:', resolvedId);
           event.stopImmediatePropagation();
           event.preventDefault();
           
           if (resolvedId) {
               import('./ui.js').then(module => {
                   module.openSidebar(resolvedId);
               });
           }
           return true; 
        }

        const nodeGroup = element.closest('.node, .cluster, .actor, .requirementBox');
        if (!nodeGroup) return false;

        const viewer = document.getElementById('viewer');
        const resolvedId = resolveActiveNodeId(nodeGroup, viewer, globals.idMap, context.filePath);

        if (resolvedId) {
            console.group('%c🎯 Default Interceptor', 'color: #777; font-weight: bold;');
            console.log('Target ID:', resolvedId);
            console.log('Diagram Type:', context.diagramType);
            console.groupEnd();
        }
        return false;
    }
}

/**
 * Standard extraction logic for most diagrams
 */
function handleStandardInterception(event, element, context, label, color) {
    const nodeGroup = element.closest('.mindmap-node, .node, .cluster, .actor, .requirementBox');
    if (!nodeGroup) return false;

    // CHECK FOR BADGE CLICK
    if (element.classList.contains('clickable-badge')) {
       const viewer = document.getElementById('viewer');
       const resolvedId = resolveActiveNodeId(nodeGroup, viewer, globals.idMap, context.filePath);
       
       console.log('🔘 Comment Badge Clicked on:', resolvedId);
       event.stopImmediatePropagation();
       event.preventDefault();
       
       if (resolvedId) {
           // Open sidebar directly
           import('./ui.js').then(module => {
               module.openSidebar(resolvedId);
           });
       }
       return true; 
    }

    const viewer = document.getElementById('viewer');
    const resolvedId = resolveActiveNodeId(nodeGroup, viewer, globals.idMap, context.filePath);

    console.group(`%c${label}`, `color: ${color}; font-weight: bold;`);
    
    // Check Mindmap/Diagram Registry
    const entry = globals.mindmapRegistry[context.filePath]?.[element.textContent?.trim()];
    if (entry) {
        console.log('✅ Resolved via Registry:', entry);
    } else {
        console.log('Resolved ID:', resolvedId || 'N/A');
    }
    
    console.log('File Content Context:', context.filePath);
    console.groupEnd();

    event.stopImmediatePropagation();
    event.preventDefault();
    return true; 
}

const strategies = [
    new NavigationInterceptor(),
    new MindmapInterceptor(),
    new PersonaInterceptor(),
    new JourneyInterceptor(),
    new ComponentInterceptor(),
    new SequenceInterceptor(),
    new DataInterceptor(),
    new StateInterceptor(),
    new FlowInterceptor(),
    new BoundaryInterceptor(),
    new ContextInterceptor(),
    new RequirementInterceptor(),
    new DefaultInterceptor()
];

export function initInterceptors() {
    const viewer = document.getElementById('viewer');
    
    const unifiedHandler = (e) => {
        // Don't intercept native links
        if (e.target.closest('a')) return;

        const target = e.target;
        const filePath = currentViewPath;
        
        // Detect diagram type from content or SVG attributes or Path
        const svg = viewer.querySelector('svg');
        const parts = filePath.replace(/\\/g, '/').split('/');
        const fileName = parts[parts.length - 1];
        const folderName = parts[parts.length - 2];

        let diagramType = 'unknown';
        
        // 1. Path-based Categories
        const categories = [
            'personas', 'journeys', 'components', 'sequences', 
            'data', 'states', 'flows', 'boundaries', 
            'context', 'requirements'
        ];
        
        for (const cat of categories) {
            if (parts.includes(cat)) {
                diagramType = cat;
                break;
            }
        }

        // 2. Special Overrides
        if (svg) {
            if (svg.querySelector('.mindmap-node')) {
                // Heuristic for navigation diagrams: root.mermaid or category indexes
                if (fileName === 'root.mermaid' || (folderName && fileName === `${folderName}.mermaid`)) {
                    diagramType = 'navigation';
                } else if (diagramType === 'unknown') {
                    diagramType = 'mindmap';
                }
            }
        }

        const context = {
            filePath,
            diagramType,
            diagramId: (folderName && fileName === `${folderName}.mermaid`) ? folderName.toUpperCase() : (fileName === 'root.mermaid' ? 'ROOT' : null)
        };

        for (const strategy of strategies) {
            if (strategy.canHandle(context)) {
                if (strategy.handle(e, target, context)) break;
            }
        }
    };

    viewer.addEventListener('click', unifiedHandler);
    
    // Delegation for Context Menu
    viewer.addEventListener('contextmenu', (e) => {
        // Disable context menu on root views (navigation diagrams)
        const filePath = currentViewPath;
        const parts = filePath.replace(/\\/g, '/').split('/');
        const fileName = parts[parts.length - 1];
        const folderName = parts[parts.length - 2]; // e.g. 'foundryspec'

        if (fileName === 'root.mermaid' || (folderName && fileName === `${folderName}.mermaid`)) {
            e.preventDefault();
            return;
        }
        const target = e.target;
        const nodeContainer = target.closest('.node, .mindmap-node, .cluster, .requirementBox, text, .edgeLabel, .actor, g[name], g[id*="actor"]');
        if (!nodeContainer) return;

        const resolvedId = resolveActiveNodeId(nodeContainer, viewer, globals.idMap, currentViewPath);
        if (!resolvedId) return;

        // Try delegating to specialized viewer first
        const viewerElement = viewer.querySelector('diagram-viewer, persona-viewer, journey-viewer, component-viewer, sequence-viewer, data-viewer, state-viewer, flow-viewer, boundary-viewer, context-viewer, requirement-viewer');
        
        if (viewerElement && typeof viewerElement.handleContextMenu === 'function') {
            if (viewerElement.handleContextMenu(e, resolvedId, nodeContainer)) {
                e.preventDefault();
                return;
            }
        }

        // Default Context Menu Fallback
        setActiveNodeId(resolvedId);
        const contextMenu = document.getElementById('context-menu');
        if (contextMenu) {
            e.preventDefault();
            resetContextMenu(); // Restore defaults before showing
            
            // Apply specialized labels if it's a Persona node
            if (resolvedId.startsWith('PER_')) {
                 const menuComments = document.getElementById('menu-comments');
                 if (menuComments) menuComments.innerText = 'View Persona Profile';
            }

            contextMenu.style.display = 'block';
            
            contextMenu.style.left = `${e.pageX}px`;
            contextMenu.style.top = `${e.pageY}px`;
        }
    });

    console.log('[FoundrySpec] Interceptors Initialized with Specialized Viewer Support');
}

import { setActiveNodeId } from './state.js';
