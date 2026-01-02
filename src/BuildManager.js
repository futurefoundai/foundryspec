import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { glob } from 'glob';

export class BuildManager {
    constructor(projectDir = process.cwd()) {
        this.projectDir = projectDir;
        this.configPath = path.join(this.projectDir, 'foundry.config.json');
    }

    async build() {
        if (!await fs.pathExists(this.configPath)) {
            throw new Error('foundry.config.json not found. Are you in a FoundrySpec project?');
        }

        const config = await fs.readJson(this.configPath);
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
        await fs.copy(assetsDir, path.join(outputDir, 'assets'), {
            filter: (src) => !src.endsWith('.mermaid') // Only copy static assets, diagrams are indexed
        });

        console.log(chalk.green(`\n✅ Build complete! Documentation is in: ${outputDir}`));
    }

    async processCategory(category, assetsDir, outputDir) {
        const categoryPath = path.join(assetsDir, category.path);
        if (!await fs.pathExists(categoryPath)) return;

        const mermaidFiles = await glob('**/*.mermaid', { cwd: categoryPath });
        const diagrams = [];

        for (const file of mermaidFiles) {
            const content = await fs.readFile(path.join(categoryPath, file), 'utf8');
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
    }

    async generateHub(config, outputDir, activeCategories) {
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

    async serve(port = 3000) {
        if (!await fs.pathExists(this.configPath)) {
            throw new Error('foundry.config.json not found.');
        }

        const config = await fs.readJson(this.configPath);
        const outputDir = path.resolve(this.projectDir, config.build.outputDir || 'dist');

        if (!await fs.pathExists(outputDir)) {
            console.log(chalk.yellow(`\n⚠️  Output folder "dist" not found. Building first...`));
            await this.build();
        }

        const http = await import('http');
        const server = http.createServer((req, res) => {
            let url = req.url.split('?')[0];
            let filePath = path.join(outputDir, url === '/' ? 'index.html' : url);

            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404);
                    res.end("Not Found");
                    return;
                }

                const ext = path.extname(filePath);
                const contentTypes = {
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

        server.listen(port, () => {
            console.log(chalk.green(`\n🚀 Documentation Hub live at: http://localhost:${port}`));
            console.log(chalk.gray(`Press Ctrl+C to stop.`));
        });
    }
}
