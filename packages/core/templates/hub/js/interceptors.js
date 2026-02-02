
import { currentViewPath, globals } from './state.js';
import { resolveActiveNodeId } from './utils.js';
import { loadDiagram } from './diagram.js';
import { openNavigationModal } from './ui.js';

/**
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
        const nodeGroup = element.closest('.mindmap-node, .node');
        if (!nodeGroup) return false;

        const viewer = document.getElementById('viewer');
        const resolvedId = resolveActiveNodeId(nodeGroup, viewer, globals.idMap, context.filePath);

        console.group('%c🧠 Mindmap Interceptor', 'color: #00ccff; font-weight: bold;');
        
        const entry = globals.mindmapRegistry[context.filePath]?.[element.textContent?.trim()];
        if (entry) {
            console.log('✅ Resolved via Mindmap Registry:', entry);
        } else {
            console.log('Resolved ID:', resolvedId || 'N/A');
        }
        
        console.log('File Content Context:', context.filePath);
        console.groupEnd();

        event.stopImmediatePropagation();
        event.preventDefault();
        return true; 
    }
}

class DefaultInterceptor {
    canHandle() {
        return true;
    }

    handle(event, element, context) {
        const nodeGroup = element.closest('.node, .cluster, .actor, .requirementBox');
        if (!nodeGroup) return false;

        const viewer = document.getElementById('viewer');
        const resolvedId = resolveActiveNodeId(nodeGroup, viewer, globals.idMap, context.filePath);

        if (resolvedId) {
            console.group('%c🎯 Default Interceptor', 'color: #ff9900; font-weight: bold;');
            console.log('Target ID:', resolvedId);
            console.log('Diagram Type:', context.diagramType);
            console.groupEnd();
        }
        return false;
    }
}

const strategies = [
    new NavigationInterceptor(),
    new MindmapInterceptor(),
    new DefaultInterceptor()
];

export function initInterceptors() {
    const viewer = document.getElementById('viewer');
    
    const unifiedHandler = (e) => {
        // Don't intercept native links
        if (e.target.closest('a')) return;

        const target = e.target;
        const filePath = currentViewPath;
        
        // Detect diagram type from content or SVG attributes
        const svg = viewer.querySelector('svg');
        const parts = filePath.replace(/\\/g, '/').split('/');
        const fileName = parts[parts.length - 1];
        const folderName = parts[parts.length - 2];
        let diagramType = 'unknown';
        
        if (svg) {
            if (svg.querySelector('.mindmap-node')) {
                // Heuristic for navigation diagrams: root.mermaid or category indexes (e.g. personas/personas.mermaid)
                if (fileName === 'root.mermaid' || (folderName && fileName === `${folderName}.mermaid`)) {
                    diagramType = 'navigation';
                } else {
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
    viewer.addEventListener('contextmenu', unifiedHandler);

    console.log('[FoundrySpec] Interceptors Initialized with Dual Event Handling');
}
