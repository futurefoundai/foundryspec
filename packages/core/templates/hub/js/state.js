export let historyStack = [];
export let currentContainer = null;
export let activeNodeId = null;
export let commentsRegistry = {};
export let lastRegistrySync = 0;
export let currentViewPath = 'root.mermaid';

// Setters for mutable exports (best practice for clarity)
export const setHistoryStack = (v) => { historyStack = v; };
export const pushHistory = (v) => { historyStack.push(v); };
export const popHistory = () => historyStack.pop();
export const setCurrentContainer = (v) => { currentContainer = v; };
export const setActiveNodeId = (v) => { activeNodeId = v; };
export const setCommentsRegistry = (v) => { commentsRegistry = v; };
export const setLastRegistrySync = (v) => { lastRegistrySync = v; };
export const setCurrentViewPath = (v) => { currentViewPath = v; };

// Globals wrapper
export const globals = {
    idMap: window.idMap,
    metadataRegistry: window.metadataRegistry || {},
    mindmapRegistry: window.mindmapRegistry || {},
    projectId: window.projectId,
    projectName: window.projectName,
    projectVersion: window.projectVersion,
    mermaid: window.mermaid,
    marked: window.marked,
    svgPanZoom: window.svgPanZoom
};
