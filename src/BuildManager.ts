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
    private projectDir: string;
    private configPath: string;

    constructor(projectDir: string = process.cwd()) {
        this.projectDir = projectDir;
        this.configPath = path.join(this.projectDir, 'foundry.config.json');
    }

    async build(): Promise<void> {
        console.time('Build process');
        if (!await fs.pathExists(this.configPath)) {
            throw new Error('foundry.config.json not found. Are you in a FoundrySpec project?');
        }

        const config: FoundryConfig = await fs.readJson(this.configPath);
        const outputDir = path.resolve(this.projectDir, config.build.outputDir || 'dist');
        const assetsDir = path.resolve(this.projectDir, config.build.assetsDir || 'assets');

        console.log(chalk.gray(`Cleaning output directory: ${outputDir}...`));
        await fs.emptyDir(outputDir);

        // --- 1. Load All Assets Once ---
        const assets = await this.loadAssets(assetsDir);

        // --- 2. Centralized Validation ---
        await this.validateFrontmatter(assets);
        await this.validateProjectGraph(assets); // Now uses loaded assets

        console.log(chalk.gray('Injecting traceability links & checking syntax...'));

        const mermaidContents: Map<string, string> = new Map();

        // --- 3. Build Global ID Registry (for Auto-Wiring) ---
        const idToFileMap: Map<string, string> = new Map();
        
        for (const asset of assets) {
            const { data, relPath } = asset;
            
            if (data?.traceability?.id) idToFileMap.set(data.traceability.id, relPath);
            if (data?.title) idToFileMap.set(data.title, relPath); // Index Title too!
            
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

        // --- 4. Prepare Mermaid Contents for Syntax Check ---
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

        await this.generateHub(config, outputDir, idToFileMap);

        console.log(chalk.gray(`Copying assets to ${outputDir}...`));
        await fs.copy(assetsDir, path.join(outputDir, 'assets'));
        
        // --- Copy root.mermaid to dist if it exists ---
        const rootMermaidPath = path.join(this.projectDir, 'root.mermaid');
        if (await fs.pathExists(rootMermaidPath)) {
            await fs.copy(rootMermaidPath, path.join(outputDir, 'root.mermaid'));
        }

        console.log(chalk.green(`
✅ Build complete! Documentation is in: ${outputDir}`));
        console.timeEnd('Build process');
    }

    async generateHub(config: FoundryConfig, outputDir: string, idMap: Map<string, string>): Promise<void> {
        const templatePath = path.resolve(__dirname, '../templates/index.html');
        if (!await fs.pathExists(templatePath)) {
            throw new Error('Hub template not found. Please reinstall FoundrySpec.');
        }
        const templateContent = await fs.readFile(templatePath, 'utf8');
        
        // Convert Map to serializable object
        const mapObj: Record<string, string> = {};
        idMap.forEach((v, k) => mapObj[k] = v);

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
        const rootMermaidPath = path.join(this.projectDir, 'root.mermaid');
        if (await fs.pathExists(rootMermaidPath)) {
            const raw = await fs.readFile(rootMermaidPath, 'utf8');
            const { data, content } = matter(raw);
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
            assets.push({
                relPath,
                absPath,
                content,
                data
            });
        }));

        return assets;
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
        const outputDir = path.resolve(this.projectDir, config.build.outputDir || 'dist');
        const assetsDir = path.resolve(this.projectDir, config.build.assetsDir || 'assets');

        if (!await fs.pathExists(outputDir) || !await fs.pathExists(path.join(outputDir, 'index.html'))) {
            console.log(chalk.yellow(`
⚠️  Output folder not found or incomplete. Building first...`));
            await this.build();
        }

        // Watch for changes in the entire project directory for simplicity,
        // especially since root.mermaid is now at the top level.
        console.log(chalk.cyan(`👀 Watching for changes in ${this.projectDir}...`));
        let isBuilding = false;
        fs.watch(this.projectDir, { recursive: true }, async (eventType, filename) => {
            // Ignore changes in dist and node_modules
            if (filename && (filename.includes('dist') || filename.includes('node_modules'))) {
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
