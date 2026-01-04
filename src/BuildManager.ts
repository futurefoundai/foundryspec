import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { glob } from 'glob';
import * as http from 'http';
import * as os from 'os';
import { exec } from 'child_process';
import util from 'util';

import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const execPromise = util.promisify(exec);

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
        if (!await fs.pathExists(this.configPath)) {
            throw new Error('foundry.config.json not found. Are you in a FoundrySpec project?');
        }

        const config: FoundryConfig = await fs.readJson(this.configPath);
        const outputDir = path.resolve(this.projectDir, config.build.outputDir || 'dist');
        const assetsDir = path.resolve(this.projectDir, config.build.assetsDir || 'assets');

        // Filter out "commented out" categories
        const activeCategories = config.categories.filter(c => c.path && !c['//path']);

        console.log(chalk.gray(`Cleaning output directory: ${outputDir}...`));
        await fs.emptyDir(outputDir);

        console.log(chalk.gray(`Indexing diagrams...`));
        for (const category of activeCategories) {
            await this.processCategory(category, assetsDir, outputDir);
        }

        console.log(chalk.gray(`Generating Documentation Hub...`));
        await this.generateHub(config, outputDir, activeCategories);

        console.log(chalk.gray(`Copying core assets...`));
        await fs.copy(assetsDir, path.join(outputDir, 'assets'));

        console.log(chalk.green(`\n✅ Build complete! Documentation is in: ${outputDir}`));
    }

    async processCategory(category: Category, assetsDir: string, outputDir: string): Promise<void> {
        const categoryPath = path.join(assetsDir, category.path);
        if (!await fs.pathExists(categoryPath)) return;

        const mermaidFiles = await glob('**/*.mermaid', { cwd: categoryPath });
        const diagrams: Diagram[] = [];

        for (const file of mermaidFiles) {
            const filePath = path.join(categoryPath, file);
            const content = await fs.readFile(filePath, 'utf8');

            try {
                // Robust validation using Mermaid CLI (headless browser)
                // We use a temporary config file for puppeteer args to run in restricted environments
                const puppeteerConfig = { args: ["--no-sandbox"] };
                const tempConfigPath = path.join(os.tmpdir(), `puppeteer-config-${Date.now()}.json`);
                await fs.writeJson(tempConfigPath, puppeteerConfig);

                const mmdcPath = path.resolve(__dirname, '../node_modules/.bin/mmdc');
                const tempOutputPath = path.join(os.tmpdir(), `temp-${Date.now()}.svg`);
                const cmd = `"${mmdcPath}" -p "${tempConfigPath}" -i "${filePath}" -o "${tempOutputPath}"`;

                await execPromise(cmd);
                await fs.remove(tempConfigPath);
                await fs.remove(tempOutputPath);
            } catch (err: any) {
                console.error(chalk.red(`\n❌ Syntax error in ${file}:`));
                // Clean up error message to be more readable
                const cleanError = err.message.split('\n').filter((l: string) => !l.includes('Puppeteer') && !l.includes('sandbox')).join('\n');
                console.error(chalk.yellow(cleanError));
                throw new Error(`Build failed due to Mermaid syntax errors.`);
            }

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
    }

    async generateHub(config: FoundryConfig, outputDir: string, activeCategories: Category[]): Promise<void> {
        const templatePath = path.join(this.projectDir, 'index.html');
        if (!await fs.pathExists(templatePath)) {
            throw new Error('Hub template (index.html) not found in project root.');
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

        // For each category, ensure we have an index.html (the viewer)
        const viewerTemplate = path.join(this.projectDir, 'assets', 'viewer.html');
        if (await fs.pathExists(viewerTemplate)) {
            const viewerContent = await fs.readFile(viewerTemplate, 'utf8');
            for (const category of activeCategories) {
                let catViewer = viewerContent
                    .replace(/{{categoryName}}/g, category.name)
                    .replace(/{{projectName}}/g, config.projectName);

                await fs.writeFile(path.join(outputDir, 'assets', category.path, 'index.html'), catViewer);
            }
        }
    }

    async serve(port: number | string = 3000): Promise<void> {
        if (!await fs.pathExists(this.configPath)) {
            throw new Error('foundry.config.json not found.');
        }

        const config: FoundryConfig = await fs.readJson(this.configPath);
        const outputDir = path.resolve(this.projectDir, config.build.outputDir || 'dist');

        if (!await fs.pathExists(outputDir)) {
            console.log(chalk.yellow(`\n⚠️  Output folder "dist" not found. Building first...`));
            await this.build();
        }

        // Use standard import for http since it's a built-in node module
        // But we are in an async function, we can keep it dynamic or move to top.
        // Moved to top for TS consistency.

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

        const portNum = typeof port === 'string' ? parseInt(port, 10) : port;
        server.listen(portNum, () => {
            console.log(chalk.green(`\n🚀 Documentation Hub live at: http://localhost:${portNum}`));
            console.log(chalk.gray(`Press Ctrl+C to stop.`));
        });
    }
}
