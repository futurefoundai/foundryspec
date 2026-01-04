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
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface CategoryTemplate {
    name: string;
    path: string;
    description: string;
    enabled: boolean;
}

interface PackageJson {
    name?: string;
    version?: string;
    type?: string;
    scripts?: Record<string, string>;
}

export class ScaffoldManager {
    private projectName: string;
    private targetDir: string;
    private templateDir: string;

    constructor(projectName?: string) {
        this.projectName = projectName || 'My Spec Project';
        // The folder name init creates should be foundryspec folder by default
        this.targetDir = path.resolve(process.cwd(), 'foundryspec');
        this.templateDir = path.resolve(__dirname, '../templates');
    }

    async init(): Promise<void> {
        if (await fs.pathExists(this.targetDir)) {
            throw new Error(`Directory "foundryspec" already exists. Move it or use a different location.`);
        }

        console.log(chalk.gray(`Creating directory structure...`));
        await fs.ensureDir(this.targetDir);

        const categories: CategoryTemplate[] = [
            { name: "Architecture", path: "architecture", description: "System context and high-level strategy", enabled: true },
            { name: "Containers", path: "containers", description: "Technical boundaries and communication", enabled: true },
            { name: "Components", path: "components", description: "Internal module structure", enabled: true },
            { name: "Sequences", path: "sequences", description: "Interaction flows and logic progression", enabled: false },
            { name: "States", path: "states", description: "State machine logic and data lifecycle", enabled: false },
            { name: "Data", path: "data", description: "Schema, contracts, and persistence", enabled: false },
            { name: "Security", path: "security", description: "Trust boundaries and threat models", enabled: false },
            { name: "Deployment", path: "deployment", description: "Infrastructure and runtime orchestration", enabled: false },
            { name: "Integration", path: "integration", description: "External APIs and ecosystem connectivity", enabled: false }
        ];

        for (const cat of categories) {
            await fs.ensureDir(path.join(this.targetDir, 'assets', cat.path));
        }
        await fs.ensureDir(path.join(this.targetDir, '.agent/workflows'));

        console.log(chalk.gray(`Copying templates...`));
        // Check if templates exist before copying to avoid errors in dev environment vs prod
        if (await fs.pathExists(path.join(this.templateDir, 'assets'))) {
            await fs.copy(path.join(this.templateDir, 'assets'), path.join(this.targetDir, 'assets'));
        }
        if (await fs.pathExists(path.join(this.templateDir, 'workflows'))) {
            await fs.copy(path.join(this.templateDir, 'workflows'), path.join(this.targetDir, '.agent/workflows'));
        }

        const contentGuidePath = path.join(this.templateDir, 'FOUNDRYSPEC_AGENT_GUIDE.md');
        if (await fs.pathExists(contentGuidePath)) {
            await fs.copy(contentGuidePath, path.join(this.targetDir, 'FOUNDRYSPEC_AGENT_GUIDE.md'));
        }

        const indexHtmlPath = path.join(this.templateDir, 'index.html');
        if (await fs.pathExists(indexHtmlPath)) {
            await fs.copy(indexHtmlPath, path.join(this.targetDir, 'index.html'));
        }

        // All categories should be included in the config but commented out (using // prefix)
        const configCategories = categories.map(cat => {
            if (cat.enabled) return { name: cat.name, path: cat.path, description: cat.description };
            return {
                "//": "Uncomment to enable this category",
                "//name": cat.name,
                "//path": cat.path,
                "//description": cat.description
            };
        });

        const config = {
            projectName: this.projectName,
            version: "1.0.0",
            categories: configCategories,
            external: [],
            build: {
                outputDir: "dist",
                assetsDir: "assets"
            }
        };

        await fs.writeJson(path.join(this.targetDir, 'foundry.config.json'), config, { spaces: 2 });

        await this.ensureGitignore(this.targetDir);
        await this.ensurePackageJson(this.targetDir);
    }

    async upgrade(): Promise<void> {
        const projectDir = process.cwd();
        const configPath = path.join(projectDir, 'foundry.config.json');

        if (!await fs.pathExists(configPath)) {
            throw new Error('Not in a FoundrySpec project. Please run from the root of your project.');
        }

        console.log(chalk.gray(`Updating templates and workflows...`));

        // Overwrite workflows and core templates if they exist in source
        if (await fs.pathExists(path.join(this.templateDir, 'workflows'))) {
            await fs.copy(path.join(this.templateDir, 'workflows'), path.join(projectDir, '.agent/workflows'), { overwrite: true });
        }
        if (await fs.pathExists(path.join(this.templateDir, 'index.html'))) {
            await fs.copy(path.join(this.templateDir, 'index.html'), path.join(projectDir, 'index.html'), { overwrite: true });
        }

        const contentGuidePath = path.join(this.templateDir, 'FOUNDRYSPEC_AGENT_GUIDE.md');
        if (await fs.pathExists(contentGuidePath)) {
            await fs.copy(contentGuidePath, path.join(projectDir, 'FOUNDRYSPEC_AGENT_GUIDE.md'), { overwrite: true });
        }

        // Update viewer and other assets without touching user diagrams
        const assetTemplateDir = path.join(this.templateDir, 'assets');
        const projectAssetDir = path.join(projectDir, 'assets');

        if (await fs.pathExists(assetTemplateDir)) {
            const assetFiles = await fs.readdir(assetTemplateDir);
            for (const file of assetFiles) {
                const src = path.join(assetTemplateDir, file);
                const stats = await fs.stat(src);
                if (!stats.isDirectory()) {
                    await fs.copy(src, path.join(projectAssetDir, file), { overwrite: true });
                }
            }
        }

        await this.ensureGitignore(projectDir);
        await this.ensurePackageJson(projectDir);
    }

    async ensureGitignore(dir: string): Promise<void> {
        const gitignorePath = path.join(dir, '.gitignore');
        let content = '';
        if (await fs.pathExists(gitignorePath)) {
            content = await fs.readFile(gitignorePath, 'utf8');
        }

        if (!content.includes('dist')) {
            console.log(chalk.gray(`Adding "dist" to .gitignore...`));
            content += content.endsWith('\n') ? 'dist\n' : '\ndist\n';
            await fs.writeFile(gitignorePath, content);
        }
    }

    async ensurePackageJson(dir: string): Promise<void> {
        const pkgPath = path.join(dir, 'package.json');
        let pkg: PackageJson = { scripts: {} };

        if (await fs.pathExists(pkgPath)) {
            pkg = await fs.readJson(pkgPath);
        } else {
            pkg.name = path.basename(dir);
            pkg.version = "1.0.0";
            pkg.type = "module";
        }

        if (!pkg.scripts) pkg.scripts = {};

        if (!pkg.scripts['docs:serve']) {
            console.log(chalk.gray(`Adding "docs:serve" script to package.json...`));
            pkg.scripts['docs:serve'] = "foundryspec serve";
            await fs.writeJson(pkgPath, pkg, { spaces: 2 });
        }
    }
}
