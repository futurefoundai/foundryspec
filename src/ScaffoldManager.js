import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ScaffoldManager {
    constructor(projectName) {
        this.projectName = projectName;
        this.targetDir = path.resolve(process.cwd(), projectName);
        this.templateDir = path.resolve(__dirname, '../templates');
    }

    async init() {
        if (await fs.pathExists(this.targetDir)) {
            throw new Error(`Directory ${this.projectName} already exists.`);
        }

        console.log(chalk.gray(`Creating directory structure...`));
        await fs.ensureDir(this.targetDir);

        // Initial folders
        const folders = [
            'assets/architecture',
            'assets/containers',
            'assets/components',
            'assets/sequences',
            'assets/states',
            'assets/data',
            'assets/security',
            'assets/deployment',
            'assets/integration',
            '.agent/workflows'
        ];

        for (const folder of folders) {
            await fs.ensureDir(path.join(this.targetDir, folder));
        }

        console.log(chalk.gray(`Copying templates...`));
        // Copy static assets
        await fs.copy(path.join(this.templateDir, 'assets'), path.join(this.targetDir, 'assets'));

        // Copy workflows
        await fs.copy(path.join(this.templateDir, 'workflows'), path.join(this.targetDir, '.agent/workflows'));

        // Create foundry.config.json
        const config = {
            projectName: this.projectName,
            version: "1.0.0",
            categories: [
                { name: "Architecture", path: "architecture", description: "System context and high-level strategy" },
                { name: "Containers", path: "containers", description: "Technical boundaries and communication" },
                { name: "Components", path: "components", description: "Internal module structure" }
            ],
            external: [],
            build: {
                outputDir: "dist",
                assetsDir: "assets"
            }
        };
        await fs.writeJson(path.join(this.targetDir, 'foundry.config.json'), config, { spaces: 2 });

        // Copy index.html base
        await fs.copy(path.join(this.templateDir, 'index.html'), path.join(this.targetDir, 'index.html'));
    }
}
