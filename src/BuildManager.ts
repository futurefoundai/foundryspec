/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU General Public License v3.0 (GPLv3).
 * For the full license text, see the LICENSE file in the root directory.
 *
 * COMMERCIAL USE:
 * Companies wishing to use this software in proprietary/closed-source environments
 * must obtain a separate license from FutureFoundAI.
 * See LICENSE-COMMERCIAL.md for details.
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { glob } from 'glob';
import * as http from 'http';
import puppeteer from 'puppeteer';
import { createRequire } from 'module';
import matter from 'gray-matter';
import serveHandler from 'serve-handler';

import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Category {
    name: string;
    path: string;
    description: string;
    '//path'?: string; // For handling commented out categories
}

interface BuildConfig {
    outputDir: string;
    assetsDir: string;
}

interface FoundryConfig {
    projectName: string;
    version: string;
    categories: Category[];
    external: any[];
    build: BuildConfig;
}

interface Diagram {
    title: string;
    description: string;
    file: string;
    updatedAt: string;
}

interface ProjectAsset {
    relPath: string;
    absPath: string;
    content: string;
    data: any;
}

export class BuildManager {
    private specDir: string;    // Directory where foundry.config.json and assets/ reside
    private projectDir: string; // Root directory for codebase scanning
    private configPath: string;

    constructor(specDir: string = process.cwd()) {
        this.specDir = path.resolve(specDir);
        // If we are in a 'foundryspec' subfolder, the codebase root is the parent.
        this.projectDir = path.basename(this.specDir) === 'foundryspec' 
            ? path.dirname(this.specDir) 
            : this.specDir;
        
        this.configPath = path.join(this.specDir, 'foundry.config.json');
    }

    async build(): Promise<void> {
        console.time('Build process');
        if (!await fs.pathExists(this.configPath)) {
            throw new Error('foundry.config.json not found. Are you in a FoundrySpec project?');
        }

        const config: FoundryConfig = await fs.readJson(this.configPath);
        const outputDir = path.resolve(this.specDir, config.build.outputDir || 'dist');
        const assetsDir = path.resolve(this.specDir, config.build.assetsDir || 'assets');

        console.log(chalk.gray(`Cleaning output directory: ${outputDir}...`));
        await fs.emptyDir(outputDir);

        // --- 1. Load All Assets Once ---
        const assets = await this.loadAssets(assetsDir);

        // --- 2. Build Global ID Registry ---
        const idToFileMap: Map<string, string> = new Map();
        for (const asset of assets) {
            const { data, relPath } = asset;
            if (data?.traceability?.id) idToFileMap.set(data.traceability.id, relPath);
            if (data?.traceability?.relationships) {
                for (const rel of data.traceability.relationships) {
                    if (rel.id) idToFileMap.set(rel.id, relPath);
                }
            }
            if (data?.traceability?.entities) {
                for (const entity of data.traceability.entities) {
                    if (entity.id) idToFileMap.set(entity.id, relPath);
                }
            }
        }

        // --- 3. Scan Codebase for Implementation Markers ---
        const codeMap = await this.scanCodebase();

        // --- 4. Centralized Validation ---
        await this.validateFrontmatter(assets);
        await this.validateProjectGraph(assets);
        await this.validateTraceability(assets, idToFileMap, codeMap);

        // --- 5. Prepare Mermaid Contents for Syntax Check ---
        const mermaidContents: Map<string, string> = new Map();
        for (const asset of assets) {
            const { relPath, content } = asset;
            if (relPath.endsWith('.mermaid')) {
                mermaidContents.set(relPath, content);
            }
        }

        // --- 5. Puppeteer Syntax Check ---
        const CONCURRENCY = 4; // User requested 4 tabs
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

        try {
            const filesArray = Array.from(mermaidContents.entries());
            const chunks = [];
            for (let i = 0; i < filesArray.length; i += Math.ceil(filesArray.length / CONCURRENCY)) {
                chunks.push(filesArray.slice(i, i + Math.ceil(filesArray.length / CONCURRENCY)));
            }

            // Fix: We need to process chunks correctly or just map concurrency controlled promises
            // Logic above was splitting into chunks equal to concurrency count (e.g. 2 chunks for CONCURRENCY=2?)
            // Actually, best way to limit concurrency is a queue or p-limit, but simple chunking works if we await Promise.all(chunks)
            // Wait, previous logic:
            // for (let i = 0; i < filesArray.length; i += Math.ceil(filesArray.length / CONCURRENCY))
            // This creates CONCURRENCY number of chunks? No, it creates chunks of size (Total/Concurrency).
            // So if 10 files, C=4, size=3. 10/3 ~ 4 chunks. So 4 parallel promises. Correct.
            
            // Re-evaluating the chunk logic to be safe and clear:
            // We want 4 parallel workers.
            const chunkSize = Math.ceil(filesArray.length / CONCURRENCY);
            const workChunks = [];
            for (let i = 0; i < filesArray.length; i += chunkSize) {
                workChunks.push(filesArray.slice(i, i + chunkSize));
            }

            await Promise.all(workChunks.map(async (chunk) => {
                // Single Page per chunk (Total 4 pages max)
                const page = await browser.newPage();
                try {
                    await page.setContent('<!DOCTYPE html><html><body><div id="container"></div></body></html>');
                    const require = createRequire(import.meta.url);
                    const mermaidPath = require.resolve('mermaid/dist/mermaid.min.js');
                    await page.addScriptTag({ path: mermaidPath });
                    await page.evaluate(() => {
                        // @ts-ignore
                        mermaid.initialize({ startOnLoad: false });
                    });

                    for (const [file, content] of chunk) {
                        try {
                            await page.evaluate((diagram) => {
                                // @ts-ignore
                                return mermaid.parse(diagram);
                            }, content);
                        } catch (err: any) {
                            console.error(chalk.red(`\n❌ Syntax error in ${file}:`));
                            console.error(chalk.yellow(err.message));
                            throw new Error(`Build failed due to Mermaid syntax errors.`);
                        }
                    }
                } finally {
                    await page.close();
                }
            }));
        } finally {
            await browser.close();
        }

        // --- Copy Hub Assets (HTML/CSS/JS) ---
        await this.generateHub(config, outputDir, idToFileMap, assets);
        
        const templateDir = path.resolve(__dirname, '../templates');
        const hubAssets = ['index.css', 'index.js'];
        for (const asset of hubAssets) {
            const assetPath = path.join(templateDir, asset);
            if (await fs.pathExists(assetPath)) {
                await fs.copy(assetPath, path.join(outputDir, asset));
            }
        }

        console.log(chalk.gray(`Copying documentation assets to ${outputDir}...`));
        await fs.copy(assetsDir, path.join(outputDir, 'assets'));

        // --- Copy root.mermaid to dist if it exists ---
        const rootMermaidPath = path.join(this.specDir, 'root.mermaid');
        if (await fs.pathExists(rootMermaidPath)) {
            await fs.copy(rootMermaidPath, path.join(outputDir, 'root.mermaid'));
        }

        console.log(chalk.green(`
✅ Build complete! Documentation is in: ${outputDir}`));
        console.timeEnd('Build process');
    }

    async generateHub(config: FoundryConfig, outputDir: string, idMap: Map<string, string>, assets: ProjectAsset[]): Promise<void> {
        const templatePath = path.resolve(__dirname, '../templates/index.html');
        if (!await fs.pathExists(templatePath)) {
            throw new Error('Hub template not found. Please reinstall FoundrySpec.');
        }
        const templateContent = await fs.readFile(templatePath, 'utf8');
        
        // Convert Map to serializable object
        const mapObj: Record<string, string> = {};
        idMap.forEach((v, k) => mapObj[k] = v);

        // Also add titles to the map for better semantic matching in the frontend
        for (const asset of assets) {
            if (asset.data?.title) {
                mapObj[asset.data.title] = asset.relPath;
            }
        }

        const rendered = templateContent
            .replace(/{{projectName}}/g, config.projectName)
            .replace(/{{version}}/g, config.version)
            .replace(/{{idMap}}/g, JSON.stringify(mapObj));

        await fs.writeFile(path.join(outputDir, 'index.html'), rendered);
    }

    private async loadAssets(assetsDir: string): Promise<ProjectAsset[]> {
        const assetsDirName = path.basename(assetsDir);
        // Load assets from assetsDir
        const assetFiles = await glob('**/*.{mermaid,md}', { cwd: assetsDir, nodir: true });
        
        const assets: ProjectAsset[] = [];
        
        // 1. Load Root Mermaid (Special Case)
        const rootMermaidPath = path.join(this.specDir, 'root.mermaid');
        if (await fs.pathExists(rootMermaidPath)) {
            const raw = await fs.readFile(rootMermaidPath, 'utf8');
            const { data, content } = matter(raw);

            // --- IMPORTANT VALIDATION: Root MUST be a mindmap ---
            if (!content.trim().startsWith('mindmap')) {
                throw new Error(chalk.red(`\n❌ Validation Error: root.mermaid must be a Mermaid mindmap.\nPlease ensure it starts with the 'mindmap' keyword.`));
            }

            assets.push({
                relPath: 'root.mermaid',
                absPath: rootMermaidPath,
                content,
                data
            });
        }

        // 2. Load Assets
        await Promise.all(assetFiles.map(async (file) => {
            const absPath = path.join(assetsDir, file);
            const raw = await fs.readFile(absPath, 'utf8');
            const { data, content } = matter(raw);
            const relPath = path.join(assetsDirName, file).replace(/\\/g, '/'); // Standardize to forward slashes

            const isRequirementFile = relPath.includes('requirements.mermaid') || relPath.includes('/requirements/');

            // --- IMPORTANT VALIDATION: Requirements MUST be requirementDiagram ---
            if (isRequirementFile && file.endsWith('.mermaid')) {
                if (!content.trim().startsWith('requirementDiagram')) {
                    throw new Error(chalk.red(`\n❌ Validation Error: ${relPath} must be a Mermaid requirementDiagram.\nPlease ensure it starts with the 'requirementDiagram' keyword.`));
                }
            }

            // --- REQ_ ID Placement Enforcement ---
            const ids = [];
            if (data?.traceability?.id) ids.push(data.traceability.id);
            if (data?.traceability?.relationships) {
                for (const rel of data.traceability.relationships) if (rel.id) ids.push(rel.id);
            }

            const hasReqId = ids.some(id => typeof id === 'string' && id.startsWith('REQ_'));
            if (hasReqId && !isRequirementFile) {
                throw new Error(chalk.red(`\n❌ Architectural Error: Requirement ID (REQ_*) found in non-requirement file: ${relPath}.\nAll requirements must reside in a dedicated requirements file.`));
            }

            assets.push({
                relPath,
                absPath,
                content,
                data
            });
        }));

        return assets;
    }

    private async getIgnoreRules(): Promise<string[]> {
        const ignoreFile = path.join(this.projectDir, '.foundryspecignore');
        const defaultIgnores = ['node_modules/**', 'dist/**', '.git/**', 'foundryspec/dist/**'];
        
        if (await fs.pathExists(ignoreFile)) {
            const content = await fs.readFile(ignoreFile, 'utf8');
            const userIgnores = content.split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));
            return [...defaultIgnores, ...userIgnores];
        }
        return defaultIgnores;
    }

    private async scanCodebase(): Promise<Map<string, string[]>> {
        console.log(chalk.blue('🔍 Scanning codebase for markers...'));
        const idToFiles: Map<string, string[]> = new Map();
        const ignoreRules = await this.getIgnoreRules();

        // Scan common code files
        const files = await glob('**/*.{ts,js,py,go,java,c,cpp,cs,rb,php,rs,swift}', {
            cwd: this.projectDir,
            nodir: true,
            ignore: ignoreRules
        });

        const markerRegex = /@foundryspec\s+([\w\-]+)/g;

        await Promise.all(files.map(async (file) => {
            const content = await fs.readFile(path.join(this.projectDir, file), 'utf8');
            let match;
            markerRegex.lastIndex = 0;
            while ((match = markerRegex.exec(content)) !== null) {
                const id = match[1];
                if (!idToFiles.has(id)) idToFiles.set(id, []);
                idToFiles.get(id)!.push(file);
            }
        }));

        const count = Array.from(idToFiles.keys()).length;
        console.log(chalk.green(`✅ Scanned codebase. Found ${count} integrated components.`));
        return idToFiles;
    }

    private async validateTraceability(assets: ProjectAsset[], idToFileMap: Map<string, string>, codeMap: Map<string, string[]>): Promise<void> {
        console.log(chalk.blue('🔍 Validating semantic traceability (Spec <-> Code)...'));
        
        // 1. Cross-reference Spec IDs referenced in Code
        for (const [id, files] of codeMap.entries()) {
            if (!idToFileMap.has(id)) {
                const errorMsg = `\n❌ Semantic Error: Code references non-existent FoundrySpec ID "${id}" in:\n${files.map(f => `   - ${f}`).join('\n')}`;
                throw new Error(chalk.red(errorMsg));
            }
        }

        // 2. Validate internal Spec references (Frontmatter Uplinks/Downlinks)
        const assetMap: Map<string, ProjectAsset> = new Map(assets.map(a => [a.relPath, a]));

        for (const asset of assets) {
            const { relPath, data } = asset;
            if (data?.traceability) {
                const checkId = (target: any) => {
                    const targets = Array.isArray(target) ? target : [target];
                    for (const t of targets) {
                        if (typeof t === 'string' && !t.includes('.') && t !== 'ROOT') {
                            if (!idToFileMap.has(t)) {
                                const errorMsg = `\n❌ Traceability Error in ${relPath}: Reference to unknown ID "${t}"`;
                                throw new Error(chalk.red(errorMsg));
                            }

                            // --- Reciprocity Check ---
                            const targetFile = idToFileMap.get(t)!;
                            const targetAsset = assetMap.get(targetFile);
                            if (targetAsset?.data?.traceability) {
                                // If this is a downlink, target MUST have an uplink to this ID
                                const currentId = data.traceability.id;
                                const isDownlink = Array.isArray(data.traceability.downlinks) 
                                    ? data.traceability.downlinks.includes(t)
                                    : data.traceability.downlinks === t;

                                if (isDownlink && currentId) {
                                    const targetUplink = targetAsset.data.traceability.uplink;
                                    const uplinks = Array.isArray(targetUplink) ? targetUplink : [targetUplink];
                                    if (!uplinks.includes(currentId)) {
                                        console.warn(chalk.yellow(`\n⚠️  Reciprocity Warning: ${relPath} has a downlink to ${t}, but ${targetFile} does not have an uplink to ${currentId}.`));
                                    }
                                }
                            }
                        }
                    }
                };

                if (data.traceability.uplink) checkId(data.traceability.uplink);
                if (data.traceability.downlinks) checkId(data.traceability.downlinks);
                if (data.traceability.relationships) {
                    for (const rel of data.traceability.relationships) {
                        if (rel.uplink) checkId(rel.uplink);
                        if (rel.downlinks) checkId(rel.downlinks);
                    }
                }
            }
        }

        console.log(chalk.green('✅ Semantic traceability is valid.'));
    }

    private async validateFrontmatter(assets: ProjectAsset[]): Promise<void> {
        console.log(chalk.blue('🔍 Validating frontmatter...'));
        
        for (const { relPath, data, absPath } of assets) {
            if (!data || Object.keys(data).length === 0 || !data.title || !data.description) {
                const errorMsg = `\n❌ Metadata error in ${relPath}: Missing or incomplete frontmatter (title/description required).`;
                throw new Error(chalk.red(errorMsg));
            }
        }
        console.log(chalk.green('✅ Frontmatter is valid.'));
    }

    private async validateProjectGraph(assets: ProjectAsset[]): Promise<void> {
        console.log(chalk.blue('🔍 Validating project structure and links...'));
        
        // Ensure root.mermaid exists in loaded assets
        const rootAsset = assets.find(a => a.relPath === 'root.mermaid');
        if (!rootAsset) {
            throw new Error(chalk.red(`❌ Critical: root.mermaid not found. This file is the required entry point.`));
        }

        const allFiles = assets.map(a => a.relPath);
        const adjList: Map<string, string[]> = new Map();
        allFiles.forEach(file => adjList.set(file, []));

        const mermaidLinkRegex = /click\s+[\w\-]+\s+(?:href\s+)?"([^\"]+\.(?:mermaid|md))"/g;
        const markdownLinkRegex = /\[[^\]]+\]\(([^)]+\.(?:mermaid|md))\)/g;

        // --- Auto-Wiring: Build Global ID Registry (using passed assets) ---
        const idToFileMap: Map<string, string> = new Map();
        
        for (const asset of assets) {
            const { data, relPath } = asset;
            if (data?.traceability?.id) idToFileMap.set(data.traceability.id, relPath);
            if (data?.traceability?.relationships) {
                for (const rel of data.traceability.relationships) {
                    if (rel.id) idToFileMap.set(rel.id, relPath);
                }
            }
            if (data?.traceability?.entities) {
                for (const entity of data.traceability.entities) {
                    if (entity.id) idToFileMap.set(entity.id, relPath);
                }
            }
        }

        for (const asset of assets) {
            const { relPath, content, data } = asset;
            const fileDir = path.dirname(relPath);

            // 1. Standard Mermaid/Markdown Links (Manual)
            if (relPath.endsWith('.mermaid')) {
                let match;
                mermaidLinkRegex.lastIndex = 0;
                while ((match = mermaidLinkRegex.exec(content)) !== null) {
                    const linkTarget = match[1];
                    const linkedFile = path.normalize(path.join(fileDir, linkTarget)).replace(/\\/g, '/');
                    if (allFiles.includes(linkedFile)) adjList.get(relPath)?.push(linkedFile);
                }
            }

            let match;
            markdownLinkRegex.lastIndex = 0;
            while ((match = markdownLinkRegex.exec(content)) !== null) {
                const linkTarget = match[1];
                if (/^(https?:|mailto:)/.test(linkTarget)) continue;
                const linkedFile = path.normalize(path.join(fileDir, linkTarget)).replace(/\\/g, '/');
                if (allFiles.includes(linkedFile)) adjList.get(relPath)?.push(linkedFile);
            }

            // 2. Auto-Wired Frontmatter Links
            if (data?.traceability) {
                const processLink = (target: any) => {
                    const targets = Array.isArray(target) ? target : [target];
                    for (const t of targets) {
                        // Is it a file path?
                        if (typeof t === 'string' && t.includes('.')) {
                            const linkedFile = path.normalize(path.join(fileDir, t)).replace(/\\/g, '/');
                            if (allFiles.includes(linkedFile)) adjList.get(relPath)?.push(linkedFile);
                        }
                        // Is it an ID?
                        else if (idToFileMap.has(t)) {
                            const targetFile = idToFileMap.get(t)!;
                            adjList.get(relPath)?.push(targetFile);
                        }
                    }
                };

                if (data.traceability.uplink) processLink(data.traceability.uplink);
                if (data.traceability.downlinks) processLink(data.traceability.downlinks);
                if (data.traceability.relationships) {
                    for (const rel of data.traceability.relationships) {
                        if (rel.uplink) processLink(rel.uplink);
                        if (rel.downlinks) processLink(rel.downlinks);
                    }
                }
            }
        }

        const connectedGraph = new Set<string>();
        const queue: string[] = ['root.mermaid'];
        connectedGraph.add('root.mermaid');

        let head = 0;
        while(head < queue.length) {
            const currentFile = queue[head++];

            // Check for files that link TO the current file (A -> current)
            for(const [node, links] of adjList.entries()) {
                if(links.includes(currentFile) && !connectedGraph.has(node)) {
                    connectedGraph.add(node);
                    queue.push(node);
                }
            }

            // Check for files that the current file links TO (current -> B)
            const outgoingLinks = adjList.get(currentFile) || [];
            for(const linkedFile of outgoingLinks) {
                if(!connectedGraph.has(linkedFile)) {
                    connectedGraph.add(linkedFile);
                    queue.push(linkedFile);
                }
            }
        }

        if (connectedGraph.size !== allFiles.length) {
            const orphans = allFiles.filter(file => !connectedGraph.has(file));
            let errorMessage = chalk.red('❌ Build failed: Orphaned files detected (No Orphan Policy).\n');
            errorMessage += chalk.yellow('   The following files are not connected to the project graph originating from root.mermaid:\n');
            orphans.forEach(orphan => {
                errorMessage += chalk.gray(`   - ${orphan}\n`);
            });
            throw new Error(errorMessage);
        }

        console.log(chalk.green('✅ Project graph is valid. No orphaned files found.'));
    }

    async serve(port: number | string = 3000): Promise<void> {
        if (!await fs.pathExists(this.configPath)) {
            throw new Error('foundry.config.json not found.');
        }

        const config: FoundryConfig = await fs.readJson(this.configPath);
        const outputDir = path.resolve(this.specDir, config.build.outputDir || 'dist');
        const assetsDir = path.resolve(this.specDir, config.build.assetsDir || 'assets');

        if (!await fs.pathExists(outputDir) || !await fs.pathExists(path.join(outputDir, 'index.html'))) {
            console.log(chalk.yellow(`
⚠️  Output folder not found or incomplete. Building first...`));
            await this.build();
        }

        // Watch for changes in the spec directory
        console.log(chalk.cyan(`👀 Watching for changes in ${this.specDir}...`));
        let isBuilding = false;
        fs.watch(this.specDir, { recursive: true }, async (eventType, filename) => {
            // Ignore changes in dist
            if (filename && filename.includes('dist')) {
                return;
            }

            if (filename && !isBuilding && (filename.endsWith('.mermaid') || filename.endsWith('.md'))) {
                isBuilding = true;
                console.log(chalk.blue(`
🔄 Change detected in ${filename}. Rebuilding...`));
                try {
                    await this.build();
                } catch (err: any) {
                    // Don't exit, just log the error
                    console.error(chalk.red(`
❌ Rebuild failed: ${err.message}`));
                } finally {
                    isBuilding = false;
                }
            }
        });

        // Also watch for codebase changes if user wants bi-directional validation
        // (Optional: for now we just watch specDir for speed)

        const server = http.createServer((req, res) => {
            serveHandler(req, res, {
                public: outputDir
            });
        });

        let portNum = typeof port === 'string' ? parseInt(port, 10) : port;

        const listen = (p: number): Promise<number> => {
            return new Promise((resolve, reject) => {
                server.once('error', (err: NodeJS.ErrnoException) => {
                    if (err.code === 'EADDRINUSE') {
                        console.log(chalk.yellow(`⚠️  Port ${p} is busy, trying ${p + 1}...`));
                        resolve(listen(p + 1));
                    } else {
                        reject(err);
                    }
                });
                server.listen(p, () => resolve(p));
            });
        };

        const finalPort = await listen(portNum);
        if (finalPort !== portNum) {
            console.log(chalk.yellow(`ℹ️  Originally requested port ${portNum} was busy.`));
        }
        console.log(chalk.green(`
🚀 Documentation Hub live at: http://localhost:${finalPort}`));
        console.log(chalk.gray(`Press Ctrl+C to stop.`));
    }
}
