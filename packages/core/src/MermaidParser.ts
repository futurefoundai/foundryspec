
/**
 * © 2026 FutureFoundAI. All rights reserved.
 */

import crypto from 'crypto';
import { CacheManager } from './CacheManager.js';
import { ParseResult } from './types/cache.js';
import { RuleEngine } from './RuleEngine.js';


import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));



/**
 * @foundryspec COMP_MermaidParser
 * Service for parsing Mermaid diagrams with intelligent caching and
 * "Ultra Sonic" pure Node.js AST extraction (no JSDOM/Puppeteer).
 */
export class MermaidParser {
    private cacheManager: CacheManager;
    private ruleEngine: RuleEngine;
    private workers: Worker[] = [];
    private maxWorkers = Math.max(1, os.cpus().length - 1);
    private workerPath = path.join(__dirname, 'ParserWorker.js');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private pendingRequests: Map<string, (data: any) => void> = new Map();

    constructor(ruleEngine: RuleEngine, cacheManager: CacheManager) {
        this.ruleEngine = ruleEngine;
        this.cacheManager = cacheManager;
    }

    private hashContent(content: string): string {
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    async parseWithCache(filePath: string, content: string): Promise<ParseResult> {
        let hash: string;
        try {
            hash = await this.cacheManager.getFileHash(filePath);
        } catch {
            hash = this.hashContent(content);
        }

        const cached = this.cacheManager.getArtifact(hash);
        if (cached) {
            return {
                diagramType: cached.diagramType,
                nodes: cached.nodes || [],
                definedNodes: cached.definedNodes || [],
                relationships: cached.relationships || [],
                mindmapMappings: cached.mindmapMappings,
                fromCache: true,
            };
        }

        const result = await this.analyze(content);

        this.cacheManager.setArtifact(hash, {
            diagramType: result.diagramType,
            ast: result.ast,
            validationErrors: result.validationErrors || [],
            timestamp: Date.now(),
            version: '2.0.0', // Ultra Sonic Version
            nodes: result.nodes,
            definedNodes: result.definedNodes,
            relationships: result.relationships,
            mindmapMappings: result.mindmapMappings
        });

        return {
            ...result,
            fromCache: false,
        };
    }

    /**
     * "Ultra Sonic" Pure AST Parsing (Offloaded to worker)
     * Returns raw analysis results (nodes, relationships, AST).
     */
    public async analyze(content: string): Promise<Omit<ParseResult, 'fromCache'>> {
        const type = this.detectType(this.cleanContent(content));

        return new Promise((resolve) => {
            const worker = this.getWorker();
            const requestId = Math.random().toString(36).substr(2, 9);

            this.pendingRequests.set(requestId, resolve);
            worker.postMessage({ content, type, requestId });
        });
    }

    private getWorker(): Worker {
        if (this.workers.length < this.maxWorkers) {
            const worker = new Worker(this.workerPath);
            
            // Persistent listener for this worker
            worker.on('message', (data: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                const { requestId } = data;
                const resolve = this.pendingRequests.get(requestId);
                if (resolve) {
                    this.pendingRequests.delete(requestId);
                    resolve(data);
                }
            });

            this.workers.push(worker);
            return worker;
        }

        // Simple round-robin
        const index = Math.floor(Math.random() * this.workers.length);
        return this.workers[index];
    }

    /**
     * Terminate all worker threads to allow the process to exit.
     */
    public async terminate(): Promise<void> {
        await Promise.all(this.workers.map(w => w.terminate()));
        this.workers = [];
        this.pendingRequests.clear();
    }

    private cleanContent(content: string): string {
         // Remove frontmatter
        return content.replace(/^---\n[\s\S]*?\n---\n/, '')
                             .replace(/%%.*\n/g, '')
                             .trim();
    }

    private detectType(cleaned: string): string {
        const match = cleaned.match(/^([a-zA-Z0-9_-]+)/);
        return match ? match[1].toLowerCase() : 'unknown';
    }

    async clearCache(): Promise<void> {
        await this.cacheManager.clear();
    }

    getCacheStats(): { entries: number; size: number } {
        const stats = this.cacheManager.getStats();
        return {
            entries: stats.artifacts,
            size: 0 
        };
    }

    async cleanup(): Promise<void> {
        await this.cacheManager.prune();
    }

    async flush(): Promise<void> {
        await this.cacheManager.flush();
    }
}
