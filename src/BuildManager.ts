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

        console.log(chalk.gray(`Discovering categories in ${assetsDir}...`));
        const activeCategories = await this.discoverCategories(config, assetsDir);

        console.log(chalk.gray(`Cleaning output directory: ${outputDir}...`));
        await fs.emptyDir(outputDir);

        console.log(chalk.gray(`Indexing diagrams for ${activeCategories.length} categories...`));

        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        try {
            for (const category of activeCategories) {
                await this.processCategory(category, assetsDir, outputDir, browser);
            }
        } finally {
            await browser.close();
        }

        console.log(chalk.gray(`Generating Documentation Hub...`));
        await this.generateHub(config, outputDir, activeCategories);

        console.log(chalk.gray(`Copying core assets...`));
        await fs.copy(assetsDir, path.join(outputDir, 'assets'));

        console.log(chalk.green(`\n✅ Build complete! Documentation is in: ${outputDir}`));
        console.timeEnd('Build process');
    }

    async processCategory(category: Category, assetsDir: string, outputDir: string, browser: puppeteer.Browser): Promise<void> {
        const categoryPath = path.join(assetsDir, category.path);
        if (!await fs.pathExists(categoryPath)) return;

        const mermaidFiles = await glob('**/*.mermaid', { cwd: categoryPath });
        const diagrams: Diagram[] = [];

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

            for (const file of mermaidFiles) {
                const filePath = path.join(categoryPath, file);
                const content = await fs.readFile(filePath, 'utf8');

                try {
                    await page.evaluate((diagram) => {
                        // @ts-ignore
                        return mermaid.parse(diagram);
                    }, content);
                } catch (err: any) {
                    console.error(chalk.red(`\n❌ Syntax error in ${category.name} > ${file}:`));
                    console.error(chalk.gray(`   Full path: ${filePath}`));
                    console.error(chalk.yellow(err.message));
                    throw new Error(`Build failed due to Mermaid syntax errors.`);
                }

                // Path Integrity Validation
                await this.validateDiagramLinks(content, filePath, categoryPath);

            // Basic title/desc extraction from frontmatter or comments
            const titleMatch = content.match(/title:\s*(.*)/i) || content.match(/%% title:\s*(.*)/i);
            const descMatch = content.match(/description:\s*(.*)/i) || content.match(/%% description:\s*(.*)/i);

            diagrams.push({
                title: titleMatch ? titleMatch[1].trim() : file,
                description: descMatch ? descMatch[1].trim() : "No description provided.",
                file: file,
                updatedAt: new Date().toISOString()
            });
        }

        const categoryOutputDir = path.join(outputDir, 'assets', category.path);
        await fs.ensureDir(categoryOutputDir);
        await fs.writeJson(path.join(categoryOutputDir, 'diagrams.json'), diagrams, { spaces: 2 });

        // Copy footnotes directory to centralized footnotes directory
        const footnotesDirPath = path.join(categoryPath, 'footnotes');
        if (await fs.pathExists(footnotesDirPath)) {
            // category.path is something like 'architecture'
            const centralizedCategoryFootnotesDir = path.join(outputDir, 'footnotes', category.path);
            console.log(chalk.gray(`Found footnotes directory for ${category.name}, copying to /footnotes/${category.path}...`));
            await fs.ensureDir(centralizedCategoryFootnotesDir);
            await fs.copy(footnotesDirPath, centralizedCategoryFootnotesDir);
        }
        } finally {
            await page.close();
        }
    }

    async generateHub(config: FoundryConfig, outputDir: string, activeCategories: Category[]): Promise<void> {
        // Read hub template from CLI templates, not user project
        const templatePath = path.resolve(__dirname, '../templates/index.html');
        if (!await fs.pathExists(templatePath)) {
            throw new Error('Hub template not found in CLI templates. Please reinstall FoundrySpec.');
        }

        const templateContent = await fs.readFile(templatePath, 'utf8');

        // Simple replacement for basic variables
        let rendered = templateContent
            .replace(/{{projectName}}/g, config.projectName)
            .replace(/{{version}}/g, config.version);

        // Inject categories into the grid
        const categoryHtml = activeCategories.map(c => `
            <a href="assets/${c.path}/index.html" class="dir-card">
                <h2>${c.name}</h2>
                <p>${c.description}</p>
            </a>
        `).join('');

        rendered = rendered.replace('<!-- Categories will be injected here or statically generated -->', categoryHtml);

        await fs.writeFile(path.join(outputDir, 'index.html'), rendered);

        // Read viewer template from CLI templates, not user project
        const viewerTemplate = path.resolve(__dirname, '../templates/assets/viewer.html');
        if (!await fs.pathExists(viewerTemplate)) {
            throw new Error('Viewer template not found in CLI templates. Please reinstall FoundrySpec.');
        }

        const viewerContent = await fs.readFile(viewerTemplate, 'utf8');
        for (const category of activeCategories) {
            let catViewer = viewerContent
                .replace(/{{categoryName}}/g, category.name)
                .replace(/{{projectName}}/g, config.projectName);

            await fs.writeFile(path.join(outputDir, 'assets', category.path, 'index.html'), catViewer);
        }
    }

    private async discoverCategories(config: FoundryConfig, assetsDir: string): Promise<Category[]> {
        const discoveredPaths = await fs.readdir(assetsDir);
        const categories: Category[] = [];

        for (const p of discoveredPaths) {
            const fullPath = path.join(assetsDir, p);
            const stat = await fs.stat(fullPath);

            // Only process directories
            if (!stat.isDirectory()) continue;

            // Check for mermaid files in this directory
            const mermaidFiles = await glob('**/*.mermaid', { cwd: fullPath });
            if (mermaidFiles.length === 0) continue;

            // See if we have metadata in config
            const existing = (config.categories || []).find(c => c.path === p);

            if (existing) {
                // Preserve explicit metadata but ensure path is correct
                categories.push({
                    name: existing.name || p,
                    path: p,
                    description: existing.description || `Specifications for ${p}`
                });
            } else {
                // Auto-generate basic metadata
                categories.push({
                    name: p.charAt(0).toUpperCase() + p.slice(1),
                    path: p,
                    description: `Automatically discovered specifications in ${p}`
                });
            }
        }

        return categories;
    }

    private async validateDiagramLinks(content: string, filePath: string, categoryPath: string): Promise<void> {
        // Match click commands: click NodeID "/footnotes/category/file.md"
        // Also handles relative links like "footnotes/file.md"
        // Regex refined to capture various quote styles and paths
        const clickRegex = /click\s+\w+\s+["']?([^"'\s>]+)["']?/g;
        let match;

        while ((match = clickRegex.exec(content)) !== null) {
            const targetUrl = match[1];

            // We only care about internal footnote links for validation
            if (targetUrl.includes('footnotes/')) {
                const footnoteFileName = path.basename(targetUrl);
                
                // Search for the footnote file in the category's footnotes directory
                const sourceFootnotePath = path.join(categoryPath, 'footnotes', footnoteFileName);

                if (!await fs.pathExists(sourceFootnotePath)) {
                    console.error(chalk.red(`\n❌ Path Integrity Error in ${path.relative(this.projectDir, filePath)}:`));
                    console.error(chalk.yellow(`   Broken link: "${targetUrl}"`));
                    console.error(chalk.gray(`   Looking for file at: ${path.relative(this.projectDir, sourceFootnotePath)}`));
                    throw new Error(`Build failed due to broken diagram links.`);
                }
            }
        }
    }


    async serve(port: number | string = 3000): Promise<void> {
        if (!await fs.pathExists(this.configPath)) {
            throw new Error('foundry.config.json not found.');
        }

        const config: FoundryConfig = await fs.readJson(this.configPath);
        const outputDir = path.resolve(this.projectDir, config.build.outputDir || 'dist');
        const assetsDir = path.resolve(this.projectDir, config.build.assetsDir || 'assets');

        if (!await fs.pathExists(outputDir)) {
            console.log(chalk.yellow(`\n⚠️  Output folder "dist" not found. Building first...`));
            await this.build();
        }

        // Setup File Watcher for Hot-Reloading
        console.log(chalk.cyan(`👀 Watching for changes in ${assetsDir}...`));
        let isBuilding = false;
        fs.watch(assetsDir, { recursive: true }, async (eventType, filename) => {
            if (filename && !isBuilding && (filename.endsWith('.mermaid') || filename.endsWith('.md'))) {
                isBuilding = true;
                console.log(chalk.blue(`\n🔄 Change detected in ${filename}. Rebuilding...`));
                try {
                    await this.build();
                } catch (err: any) {
                    console.error(chalk.red(`\n❌ Rebuild failed: ${err.message}`));
                } finally {
                    isBuilding = false;
                }
            }
        });

        const server = http.createServer((req, res) => {
            let url = (req.url || '/').split('?')[0];
            let filePath = path.join(outputDir, url === '/' ? 'index.html' : url);

            fs.readFile(filePath, (err: NodeJS.ErrnoException | null, data: Buffer) => {
                if (err) {
                    res.writeHead(404);
                    res.end("Not Found");
                    return;
                }

                const ext = path.extname(filePath);
                const contentTypes: Record<string, string> = {
                    '.html': 'text/html',
                    '.js': 'text/javascript',
                    '.css': 'text/css',
                    '.json': 'application/json',
                    '.png': 'image/png',
                    '.jpg': 'image/jpg',
                    '.svg': 'image/svg+xml'
                };

                res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
                res.end(data);
            });
        });

        let portNum = typeof port === 'string' ? parseInt(port, 10) : port;
        const maxAttempts = 10;
        let attempts = 0;

        const tryListen = (currentPort: number): Promise<void> => {
            return new Promise((resolve, reject) => {
                server.once('error', (err: NodeJS.ErrnoException) => {
                    if (err.code === 'EADDRINUSE') {
                        attempts++;
                        if (attempts >= maxAttempts) {
                            reject(new Error(`Unable to find an available port after ${maxAttempts} attempts (tried ${portNum}-${currentPort})`));
                            return;
                        }
                        console.log(chalk.yellow(`⚠️  Port ${currentPort} is busy, trying ${currentPort + 1}...`));
                        tryListen(currentPort + 1).then(resolve).catch(reject);
                    } else {
                        reject(err);
                    }
                });

                server.listen(currentPort, () => {
                    if (currentPort !== portNum) {
                        console.log(chalk.yellow(`ℹ️  Originally requested port ${portNum} was busy.`));
                    }
                    console.log(chalk.green(`\n🚀 Documentation Hub live at: http://localhost:${currentPort}`));
                    console.log(chalk.gray(`Press Ctrl+C to stop.`));
                    resolve();
                });
            });
        };

        await tryListen(portNum);
    }
}
