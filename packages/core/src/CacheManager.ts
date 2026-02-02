/**
 * © 2026 FutureFoundAI. All rights reserved.
 */

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import chalk from 'chalk';

// Tier 1: File Metadata
export interface FileMetadataCache {
    [absPath: string]: {
        mtime: number;
        size: number;
        contentHash: string;
    }
}

// Tier 2: Build Artifacts (Content Addressable)
export interface BuildArtifactEntry {
    diagramType: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ast: any | null; 
    validationErrors?: Array<{ line: number; message: string }>;
    timestamp: number;
    version: string;
    // Potentially store raw nodes/relationships here too if we want to skip re-analysis
    nodes?: string[];
    definedNodes?: string[];
    relationships?: { from: string; to: string; label?: string }[];
    mindmapMappings?: Record<string, string>;
}

export interface BuildArtifactCache {
    [contentHash: string]: BuildArtifactEntry;
}

export class CacheManager {
    private projectRoot: string;
    private cacheDir: string;
    private metadataFile: string;
    private artifactsFile: string;
    
    private metadataCache: FileMetadataCache = {};
    private artifactCache: BuildArtifactCache = {};
    private isDirty = false;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
        // Project-Local Cache
        this.cacheDir = path.join(this.projectRoot, '.foundry', 'cache');
        this.metadataFile = path.join(this.cacheDir, 'file-metadata.json');
        this.artifactsFile = path.join(this.cacheDir, 'build-cache.json');
    }

    async init(): Promise<void> {
        try {
            await fs.ensureDir(this.cacheDir);
            
            if (await fs.pathExists(this.metadataFile)) {
                this.metadataCache = await fs.readJson(this.metadataFile);
            }
            if (await fs.pathExists(this.artifactsFile)) {
                this.artifactCache = await fs.readJson(this.artifactsFile);
            }
        } catch (error) {
            console.warn(chalk.yellow('Failed to load cache, starting fresh'), error);
            // Fallback to empty
            this.metadataCache = {};
            this.artifactCache = {};
        }
    }

    /**
     * Tier 1 Check: Get content hash from metadata if file hasn't changed.
     * Otherwise read file diff, hash it, and update Tier 1.
     */
    async getFileHash(absPath: string): Promise<string> {
        const stats = await fs.stat(absPath);
        const entry = this.metadataCache[absPath];

        if (entry && entry.mtime === stats.mtimeMs && entry.size === stats.size) {
            return entry.contentHash;
        }

        // Cache Miss or Invalid - Read File
        const content = await fs.readFile(absPath, 'utf8');
        const hash = crypto.createHash('sha256').update(content).digest('hex');

        // Update Tier 1
        this.metadataCache[absPath] = {
            mtime: stats.mtimeMs,
            size: stats.size,
            contentHash: hash
        };
        this.isDirty = true;
        
        return hash;
    }

    /**
     * Tier 2 Check: Get artifact by Content Hash
     */
    getArtifact(contentHash: string): BuildArtifactEntry | undefined {
        return this.artifactCache[contentHash];
    }

    /**
     * Save artifact to Tier 2 cache
     */
    setArtifact(contentHash: string, entry: BuildArtifactEntry): void {
        this.artifactCache[contentHash] = entry;
        this.isDirty = true;
    }

    async flush(): Promise<void> {
        if (!this.isDirty) return;
        
        try {
            await fs.writeJson(this.metadataFile, this.metadataCache, { spaces: 0 }); // Minimize size
            await fs.writeJson(this.artifactsFile, this.artifactCache, { spaces: 0 });
            this.isDirty = false;
        } catch (error) {
            console.warn(chalk.yellow('Failed to flush cache to disk'), error);
        }
    }

    /**
     * Maintenance: Prune artifacts not referenced by any current file in metadata
     * (Or just old LRU - for now let's keep it simple: Prune by age)
     */
    async prune(maxAgeMs = 30 * 24 * 60 * 60 * 1000): Promise<void> {
        const now = Date.now();
        let pruned = 0;
        
        // 1. Prune Metadata: Remove entries that no longer exist on disk
        for (const absPath of Object.keys(this.metadataCache)) {
           if (!await fs.pathExists(absPath)) {
               delete this.metadataCache[absPath];
               this.isDirty = true;
           }
        }

        // 2. Prune Artifacts: Remove old entries
        for (const [hash, entry] of Object.entries(this.artifactCache)) {
            if (now - entry.timestamp > maxAgeMs) {
                delete this.artifactCache[hash];
                pruned++;
            }
        }
        
        if (pruned > 0) {
            this.isDirty = true;
            console.log(chalk.gray(`Drafting cache: Pruned ${pruned} old artifacts.`));
        }
    }

    async clear(): Promise<void> {
        this.metadataCache = {};
        this.artifactCache = {};
        this.isDirty = true;
        await this.flush();
    }

    getStats(): { metadataEntries: number; artifacts: number } {
        return {
            metadataEntries: Object.keys(this.metadataCache).length,
            artifacts: Object.keys(this.artifactCache).length
        };
    }
}
