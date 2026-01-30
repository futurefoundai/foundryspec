
/**
 * © 2026 FutureFoundAI. All rights reserved.
 */

import { parentPort, workerData } from 'worker_threads';
import { createRequire } from 'module';
import * as Mappers from './parsers/IntentMappers.js';

const require = createRequire(import.meta.url);

/**
 * Lightweight Parser Runner for Worker Threads
 */
class WorkerParser {
    private parsers: Record<string, any> = {
        flowchart: require('./parsers/generated/flowchartParser.cjs'),
        sequence: require('./parsers/generated/sequenceParser.cjs'),
        er: require('./parsers/generated/erParser.cjs'),
        class: require('./parsers/generated/classParser.cjs'),
        state: require('./parsers/generated/stateParser.cjs'),
        mindmap: require('./parsers/generated/mindmapParser.cjs'),
        requirement: require('./parsers/generated/requirementParser.cjs'),
        graph: require('./parsers/generated/flowchartParser.cjs'),
        sequencediagram: require('./parsers/generated/sequenceParser.cjs'),
        erdiagram: require('./parsers/generated/erParser.cjs'),
        classdiagram: require('./parsers/generated/classParser.cjs'),
        statediagram: require('./parsers/generated/stateParser.cjs'),
        requirementdiagram: require('./parsers/generated/requirementParser.cjs'),
    };

    public parse(content: string, type: string) {
        const cleaned = this.cleanContent(content);
        const resolvedType = type || this.detectType(cleaned);
        const parserModule = this.resolveParser(resolvedType);

        if (!parserModule) {
            return { diagramType: resolvedType, nodes: [], relationships: [] };
        }

        const mapper = this.createMapper(resolvedType);
        const originalParser = parserModule.parser || parserModule;
        
        // Inject yy
        const parserInstance = Object.create(originalParser);
        parserInstance.yy = mapper;

        try {
            const parseResult = parserInstance.parse(cleaned);
            const normalized = this.normalizeIntent(mapper, resolvedType, parseResult);
            return normalized;
        } catch (e: any) {
            return { 
                diagramType: resolvedType, 
                nodes: [], 
                relationships: [], 
                validationErrors: [{ line: 0, message: e.message }] 
            };
        }
    }

    private cleanContent(content: string): string {
        return content.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/%%.*\n/g, '').trim();
    }

    private detectType(cleaned: string): string {
        const match = cleaned.match(/^([a-zA-Z0-9_-]+)/);
        return match ? match[1].toLowerCase() : 'unknown';
    }

    private resolveParser(type: string): any {
        const lowerType = type.toLowerCase();
        if (this.parsers[lowerType]) return this.parsers[lowerType];
        const prefixes = ['flowchart', 'sequence', 'er', 'class', 'state', 'requirement'];
        for (const p of prefixes) {
            if (lowerType.startsWith(p)) return (this.parsers as any)[p];
        }
        return lowerType === 'graph' ? this.parsers.flowchart : null;
    }

    private createMapper(type: string): Mappers.BaseMapper {
        const lowerType = type.toLowerCase();
        if (lowerType.startsWith('flowchart') || lowerType === 'graph') return new Mappers.FlowchartMapper();
        if (lowerType.startsWith('sequence')) return new Mappers.SequenceMapper();
        if (lowerType.startsWith('class')) return new Mappers.ClassMapper();
        if (lowerType.startsWith('state')) return new Mappers.StateMapper();
        if (lowerType.startsWith('er')) return new Mappers.ERMapper();
        if (lowerType === 'mindmap') return new Mappers.MindmapMapper();
        if (lowerType.startsWith('requirement')) return new Mappers.RequirementMapper();
        return new (class extends Mappers.BaseMapper {})();
    }

    private normalizeIntent(mapper: Mappers.BaseMapper, type: string, ast: any) {
        const nodeSet = new Set<string>();
        const relationships: any[] = [];

        mapper.nodes.forEach((n: any) => {
            const id = n.id || n.name || n.text;
            if (id) nodeSet.add(String(id));
            if (n.text) nodeSet.add(String(n.text));
        });

        const processAST = (ast: any) => {
            if (!ast) return;
            if (Array.isArray(ast)) { ast.forEach(processAST); return; }
            if (ast.type === 'addParticipant' || ast.type === 'addActor') {
                const name = ast.actor?.name || ast.actor;
                if (name) nodeSet.add(name);
            }
            if (ast.type === 'addMessage') {
                const from = ast.from?.name || ast.from;
                const to = ast.to?.name || ast.to;
                if (from && to) relationships.push({ from, to, text: ast.msg, type: 'message' });
            }
            if (ast.stmt === 'state') {
                if (ast.id && ast.id !== '[*]') nodeSet.add(ast.id);
                if (ast.doc) processAST(ast.doc);
            }
            if (ast.stmt === 'relation') {
                const s1 = ast.state1?.id || ast.state1;
                const s2 = ast.state2?.id || ast.state2;
                const from = s1 === '[*]' ? 'START_NODE' : s1;
                const to = s2 === '[*]' ? 'START_NODE' : s2;
                if (from && to) relationships.push({ from, to, text: ast.description, type: 'relation' });
            }
        };

        if (mapper instanceof Mappers.SequenceMapper || mapper instanceof Mappers.StateMapper) {
            processAST(ast);
        }

        relationships.push(...mapper.edges);
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
}

const parser = new WorkerParser();

if (parentPort) {
    parentPort.on('message', (data) => {
        const { content, type, requestId } = data;
        try {
            const result = parser.parse(content, type);
            parentPort?.postMessage({ ...result, requestId });
        } catch (e: any) {
            parentPort?.postMessage({ 
                validationErrors: [{ line: 0, message: e.message }],
                requestId 
            });
        }
    });
}
