/**
 * © 2026 FutureFoundAI. All rights reserved.
 */

import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';
import { BrowserPool } from './BrowserPool.js';
import { ParseCache, ParseCacheEntry, ParseResult } from './types/cache.js';
import { RuleEngine } from './RuleEngine.js';
import chalk from 'chalk';

const require = createRequire(import.meta.url);

/**
 * Service for parsing Mermaid diagrams with intelligent caching
 */
export class MermaidParser {
    private cache: ParseCache;
    private cacheDir: string;
    private cacheFile: string;
    private cacheDirty = false;
    private ruleEngine: RuleEngine;

    constructor(ruleEngine: RuleEngine) {
        this.ruleEngine = ruleEngine;
        // Cache location: ~/.foundryspec/cache/
        this.cacheDir = path.join(os.homedir(), '.foundryspec', 'cache');
        this.cacheFile = path.join(this.cacheDir, 'parse-cache.json');
        this.cache = this.loadCache();
    }

    /**
     * Load cache from disk
     */
    private loadCache(): ParseCache {
        try {
            if (fs.existsSync(this.cacheFile)) {
                const data = fs.readFileSync(this.cacheFile, 'utf-8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.warn(chalk.yellow('Failed to load parse cache, starting fresh'));
        }

        return {
            version: '1.0.0',
            lastUpdated: Date.now(),
            entries: {},
        };
    }

    /**
     * Save cache to disk
     */
    private async saveCache(): Promise<void> {
        if (!this.cacheDirty) return;

        try {
            await fs.ensureDir(this.cacheDir);
            this.cache.lastUpdated = Date.now();
            await fs.writeFile(this.cacheFile, JSON.stringify(this.cache, null, 2));
            this.cacheDirty = false;
        } catch (error) {
            console.warn(chalk.yellow('Failed to save parse cache'));
        }
    }

    /**
     * Compute SHA256 hash of content
     */
    private hashContent(content: string): string {
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    /**
     * Parse a Mermaid diagram with caching
     */
    async parseWithCache(filePath: string, content: string): Promise<ParseResult> {
        const hash = this.hashContent(content);

        // Check cache
        if (this.cache.entries[hash]) {
            const entry = this.cache.entries[hash];
            return {
                diagramType: entry.diagramType,
                nodes: entry.nodes,
                relationships: entry.relationships,
                fromCache: true,
            };
        }

        // Cache miss - parse with mermaid
        const result = await this.parseMermaid(content);

        // Store in cache
        this.cache.entries[hash] = {
            contentHash: hash,
            timestamp: Date.now(),
            filePath: filePath,
            diagramType: result.diagramType,
            nodes: result.nodes,
            relationships: result.relationships,
        };
        this.cacheDirty = true;

        return {
            ...result,
            fromCache: false,
        };
    }

    /**
     * Parse diagram using Mermaid in browser context for validation,
     * then use analyzers for node extraction
     */
    private async parseMermaid(content: string): Promise<Omit<ParseResult, 'fromCache'>> {
        const browser = await BrowserPool.getBrowser();
        const page = await browser.newPage();

        try {
            await page.setContent('<!DOCTYPE html><html><body><div id="container"></div></body></html>');
            
            const mermaidPath = require.resolve('mermaid/dist/mermaid.min.js');
            await page.addScriptTag({ path: mermaidPath });

            // Validate syntax with mermaid
            const diagramType = await page.evaluate((diagram) => {
                // @ts-expect-error Mermaid types not fully covered
                mermaid.initialize({ startOnLoad: false });

                // Validate syntax
                // @ts-expect-error Mermaid types not fully covered
                mermaid.parse(diagram);

                // Infer diagram type from content - use keys that match RuleEngine analyzers
                const lines = diagram.trim().split('\n');
                let type = 'unknown';
                
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('sequenceDiagram')) type = 'sequenceDiagram';
                    else if (trimmed.startsWith('classDiagram')) type = 'classDiagram';
                    else if (trimmed.startsWith('graph ')) type = 'graph';
                    else if (trimmed.startsWith('flowchart ')) type = 'flowchart';
                    else if (trimmed.startsWith('stateDiagram')) type = 'stateDiagram';
                    else if (trimmed.startsWith('erDiagram')) type = 'erDiagram';
                    else if (trimmed.startsWith('mindmap')) type = 'mindmap';
                    else if (trimmed.startsWith('requirementDiagram')) type = 'requirementDiagram';
                    else if (trimmed.startsWith('C4Context')) type = 'C4Context';
                    else if (trimmed.startsWith('C4Container')) type = 'C4Container';
                    
                    if (type !== 'unknown') break;
                }

                return type;
            }, content);

            // Use RuleEngine's analyzers to extract nodes
            const analysis = this.ruleEngine.analyzeContent(content, diagramType);

            return {
                diagramType,
                nodes: analysis.nodes,
                relationships: analysis.relationships,
            };
        } finally {
            await page.close();
        }
    }

    /**
     * Clear the cache
     */
    async clearCache(): Promise<void> {
        this.cache = {
            version: '1.0.0',
            lastUpdated: Date.now(),
            entries: {},
        };
        this.cacheDirty = true;
        await this.saveCache();
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { entries: number; size: number } {
        return {
            entries: Object.keys(this.cache.entries).length,
            size: JSON.stringify(this.cache).length,
        };
    }

    /**
     * Cleanup old entries (older than 30 days)
     */
    async cleanup(): Promise<void> {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        let removed = 0;

        for (const [hash, entry] of Object.entries(this.cache.entries)) {
            if (entry.timestamp < thirtyDaysAgo) {
                delete this.cache.entries[hash];
                removed++;
            }
        }

        if (removed > 0) {
            console.log(chalk.gray(`Cleaned up ${removed} old cache entries`));
            this.cacheDirty = true;
            await this.saveCache();
        }
    }

    /**
     * Ensure cache is saved before exit
     */
    async flush(): Promise<void> {
        await this.saveCache();
    }
}
