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

        // New validation logic
        await this.validateProjectGraph(assetsDir);

        console.log(chalk.gray('Project graph is valid. Validating frontmatter in parallel...'));

        const allMermaidFiles = await glob('**/*.mermaid', { cwd: assetsDir });
        const mermaidContents: Map<string, string> = new Map();

        // --- Parallel Frontmatter Validation ---
        await Promise.all(allMermaidFiles.map(async (file) => {
            const filePath = path.join(assetsDir, file);
            const rawContent = await fs.readFile(filePath, 'utf8');
            const { data, content } = matter(rawContent);

            if (!data || Object.keys(data).length === 0 || !data.title || !data.description) {
                const errorMsg = `\n❌ Metadata error in ${file}: Missing or incomplete frontmatter (title/description required).`;
                throw new Error(chalk.red(errorMsg));
            }
            mermaidContents.set(file, content);
        }));

        console.log(chalk.gray(`Frontmatter valid. Checking syntax for ${allMermaidFiles.length} files...`));

        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const CONCURRENCY = 2; // Number of parallel pages
        const chunks = [];
        const filesArray = Array.from(mermaidContents.entries());
        
        for (let i = 0; i < filesArray.length; i += Math.ceil(filesArray.length / CONCURRENCY)) {
            chunks.push(filesArray.slice(i, i + Math.ceil(filesArray.length / CONCURRENCY)));
        }

        try {
            await Promise.all(chunks.map(async (chunk) => {
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

        await this.generateHub(config, outputDir);

        console.log(chalk.gray(`Copying assets to ${outputDir}...`));
        const rootMermaidPath = path.join(this.projectDir, 'root.mermaid');
        await fs.copy(assetsDir, path.join(outputDir, 'assets'));
        await fs.copy(rootMermaidPath, path.join(outputDir, 'root.mermaid'));

        console.log(chalk.green(`
✅ Build complete! Documentation is in: ${outputDir}`));
        console.timeEnd('Build process');
    }

    async generateHub(config: FoundryConfig, outputDir: string): Promise<void> {
        const templatePath = path.resolve(__dirname, '../templates/index.html');
        if (!await fs.pathExists(templatePath)) {
            throw new Error('Hub template not found. Please reinstall FoundrySpec.');
        }
        const templateContent = await fs.readFile(templatePath, 'utf8');
        const rendered = templateContent
            .replace(/{{projectName}}/g, config.projectName)
            .replace(/{{version}}/g, config.version);

        await fs.writeFile(path.join(outputDir, 'index.html'), rendered);
    }

    private async validateProjectGraph(assetsDir: string): Promise<void> {
        console.log(chalk.blue('🔍 Validating project structure and links...'));
        const rootMermaidPath = path.join(this.projectDir, 'root.mermaid');

        if (!await fs.pathExists(rootMermaidPath)) {
            throw new Error(chalk.red(`❌ Critical: root.mermaid not found at ${rootMermaidPath}. This file is the required entry point.`));
        }

        const assetsDirName = path.basename(assetsDir);
        const assetFiles = (await glob('**/*.{mermaid,md}', { cwd: assetsDir, nodir: true }))
            .map(file => path.join(assetsDirName, file).replace(/\\/g, '/'));

        const rootRelativePath = 'root.mermaid';
        const allFiles = [rootRelativePath, ...assetFiles];

        const adjList: Map<string, string[]> = new Map();
        allFiles.forEach(file => adjList.set(file, []));

        const mermaidLinkRegex = /click\s+[\w\-]+\s+(?:href\s+)?"([^\"]+\.(?:mermaid|md))"/g;
        const markdownLinkRegex = /\[[^\]]+\]\(([^)]+\.(?:mermaid|md))\)/g;

        for (const file of allFiles) {
            const filePath = path.join(this.projectDir, file);
            const content = await fs.readFile(filePath, 'utf8');
            const fileDir = path.dirname(file);

            // Scan for Mermaid 'click' links
            if (file.endsWith('.mermaid')) {
                let match;
                mermaidLinkRegex.lastIndex = 0;
                while ((match = mermaidLinkRegex.exec(content)) !== null) {
                    const linkTarget = match[1];
                    const linkedFile = path.normalize(path.join(fileDir, linkTarget)).replace(/\\/g, '/');
                    if (allFiles.includes(linkedFile)) {
                        adjList.get(file)?.push(linkedFile);
                    }
                }
            }

            // Scan for Markdown-style links (supported in Mermaid node labels and .md files)
            let match;
            markdownLinkRegex.lastIndex = 0;
            while ((match = markdownLinkRegex.exec(content)) !== null) {
                const linkTarget = match[1];
                if (/^(https?:|mailto:)/.test(linkTarget)) continue;

                const linkedFile = path.normalize(path.join(fileDir, linkTarget)).replace(/\\/g, '/');
                if (allFiles.includes(linkedFile)) {
                    adjList.get(file)?.push(linkedFile);
                }
            }
        }

        const connectedGraph = new Set<string>();
        const queue: string[] = [rootRelativePath];
        connectedGraph.add(rootRelativePath);

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
