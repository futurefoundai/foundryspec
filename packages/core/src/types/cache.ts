/**
 * © 2026 FutureFoundAI. All rights reserved.
 */

/**
 * Cache entry for a parsed Mermaid diagram
 */
export interface ParseCacheEntry {
    /** SHA256 hash of the file content */
    contentHash: string;
    
    /** Timestamp when this entry was created */
    timestamp: number;
    
    /** Type of diagram (sequenceDiagram, classDiagram, etc.) */
    diagramType: string;
    
    /** Extracted nodes from the diagram */
    nodes: string[];
    
    /** Relationships/edges in the diagram */
    relationships: Array<{
        from: string;
        to: string;
        label?: string;
    }>;
    
    /** Original file path (for debugging) */
    filePath: string;
}

/**
 * In-memory and persistent cache for parsed diagrams
 */
export interface ParseCache {
    /** Version of the cache format */
    version: string;
    
    /** When this cache was last updated */
    lastUpdated: number;
    
    /** Map of content hash to parse result */
    entries: Record<string, ParseCacheEntry>;
}

/**
 * Result from parsing a diagram
 */
export interface ParseResult {
    /** Type of diagram */
    diagramType: string;
    
    /** Extracted nodes */
    nodes: string[];
    
    /** Relationships between nodes */
    relationships: Array<{
        from: string;
        to: string;
        label?: string;
    }>;
    
    /** Whether this came from cache */
    fromCache: boolean;
}
