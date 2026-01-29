
/**
 * © 2026 FutureFoundAI. All rights reserved.
 */

import crypto from 'crypto';
import { CacheManager } from './CacheManager.js';
import { ParseResult } from './types/cache.js';
import { RuleEngine } from './RuleEngine.js';
import { createRequire } from 'module';
import * as Mappers from './parsers/IntentMappers.js';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const require = createRequire(import.meta.url);

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
    private pendingRequests: Map<string, (data: any) => void> = new Map();

    // Parsers map (lazy loaded if needed, but we require them statically for now)
    private parsers: Record<string, any> = {
        flowchart: require('./parsers/generated/flowchartParser.cjs'),
        sequence: require('./parsers/generated/sequenceParser.cjs'),
        er: require('./parsers/generated/erParser.cjs'),
        class: require('./parsers/generated/classParser.cjs'),
        state: require('./parsers/generated/stateParser.cjs'),
        mindmap: require('./parsers/generated/mindmapParser.cjs'),
        requirement: require('./parsers/generated/requirementParser.cjs'),
        // Aliases
        graph: require('./parsers/generated/flowchartParser.cjs'),
        sequencediagram: require('./parsers/generated/sequenceParser.cjs'),
        erdiagram: require('./parsers/generated/erParser.cjs'),
        classdiagram: require('./parsers/generated/classParser.cjs'),
        statediagram: require('./parsers/generated/stateParser.cjs'),
        requirementdiagram: require('./parsers/generated/requirementParser.cjs'),
        // Aliases (CamelCase kept just in case detectType changes)
        sequenceDiagram: require('./parsers/generated/sequenceParser.cjs'),
        erDiagram: require('./parsers/generated/erParser.cjs'),
        classDiagram: require('./parsers/generated/classParser.cjs'),
        stateDiagram: require('./parsers/generated/stateParser.cjs'),
        requirementDiagram: require('./parsers/generated/requirementParser.cjs'),
    };

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
                relationships: cached.relationships || [],
                fromCache: true,
            };
        }

        const result = await this.parseMermaid(content);

        this.cacheManager.setArtifact(hash, {
            diagramType: result.diagramType,
            ast: result.ast,
            validationErrors: result.validationErrors || [],
            timestamp: Date.now(),
            version: '2.0.0', // Ultra Sonic Version
            nodes: result.nodes,
            relationships: result.relationships
        });

        return {
            ...result,
            fromCache: false,
        };
    }

    /**
     * "Ultra Sonic" Pure AST Parsing (Offloaded to worker)
     */
    private async parseMermaid(content: string): Promise<Omit<ParseResult, 'fromCache'>> {
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
            worker.on('message', (data: any) => {
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

    private resolveParser(type: string): any {
        const lowerType = type.toLowerCase();
        if (this.parsers[lowerType]) return this.parsers[lowerType];

        // Prefix match
        const prefixes = ['flowchart', 'sequence', 'er', 'class', 'state', 'requirement'];
        for (const p of prefixes) {
            if (lowerType.startsWith(p)) return (this.parsers as any)[p];
        }

        if (lowerType === 'graph') return this.parsers.flowchart;
        
        return null;
    }

    private normalizeIntent(mapper: Mappers.BaseMapper, type: string, ast: any): Omit<ParseResult, 'fromCache'> {
        const nodeSet = new Set<string>();
        const relationships: any[] = [];

        // 1. Captured via hooks
        mapper.nodes.forEach((n: any) => {
            const id = n.id || n.name;
            if (id) nodeSet.add(id);
        });

        // 2. Specialized Logic for AST-based returns (Sequence, State)
        const processAST = (ast: any) => {
            if (!ast) return;
            if (Array.isArray(ast)) {
                ast.forEach(processAST);
                return;
            }

            // Sequence Statements
            if (ast.type === 'addParticipant' || ast.type === 'addActor') {
                const name = ast.actor?.name || ast.actor;
                if (name) nodeSet.add(name);
            }
            if (ast.type === 'addMessage') {
                const from = ast.from?.name || ast.from;
                const to = ast.to?.name || ast.to;
                if (from && to) {
                    relationships.push({ from, to, text: ast.msg, type: 'message' });
                }
            }

            // State Diagram Statements
            if (ast.stmt === 'state') {
                if (ast.id && ast.id !== '[*]') nodeSet.add(ast.id);
                if (ast.doc) processAST(ast.doc);
            }
            if (ast.stmt === 'relation') {
                const s1 = ast.state1?.id || ast.state1;
                const s2 = ast.state2?.id || ast.state2;
                const from = s1 === '[*]' ? 'START_NODE' : s1;
                const to = s2 === '[*]' ? 'START_NODE' : s2;
                if (from && to) {
                    relationships.push({ from, to, text: ast.description, type: 'relation' });
                }
            }
        };

        if (mapper instanceof Mappers.SequenceMapper) {
            processAST(ast);
        }
        if (mapper instanceof Mappers.StateMapper) {
            processAST(ast);
        }

        relationships.push(...mapper.edges);

        // 3. Collect implicit nodes from edges (e.g. in Class diagrams)
        relationships.forEach(rel => {
            if (rel.from && typeof rel.from === 'string') nodeSet.add(rel.from);
            if (rel.to && typeof rel.to === 'string') nodeSet.add(rel.to);
        });

        return {
            diagramType: type,
            nodes: Array.from(nodeSet),
            relationships,
            ast: null 
        };
    }

    private sanitizeAST(ast: any): any {
        if (!ast || typeof ast !== 'object') return ast;

        // Create a copy without circular parser/lexer refs
        const sanitized: any = {};
        for (const key of Object.keys(ast)) {
            if (key === 'parser' || key === 'lexer' || key === 'yy') continue;
            
            const val = ast[key];
            if (Array.isArray(val)) {
                sanitized[key] = val.map(item => typeof item === 'object' ? '[Object]' : item);
            } else if (typeof val === 'object' && val !== null) {
                sanitized[key] = '[Object]';
            } else {
                sanitized[key] = val;
            }
        }
        return sanitized;
    }

    private createMapper(type: string): Mappers.BaseMapper {
        const lowerType = type.toLowerCase();
        
        if (lowerType.startsWith('flowchart') || lowerType === 'graph') {
            return new Mappers.FlowchartMapper();
        }
        if (lowerType.startsWith('sequence')) {
            return new Mappers.SequenceMapper();
        }
        if (lowerType.startsWith('class')) {
            return new Mappers.ClassMapper();
        }
        if (lowerType.startsWith('state')) {
            return new Mappers.StateMapper();
        }
        if (lowerType.startsWith('er')) {
            return new Mappers.ERMapper();
        }
        if (lowerType === 'mindmap') {
            return new Mappers.MindmapMapper();
        }
        if (lowerType.startsWith('requirement')) {
            return new Mappers.RequirementMapper();
        }

        // Default fallback to basic mapper
        return new (class extends Mappers.BaseMapper {})();
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
