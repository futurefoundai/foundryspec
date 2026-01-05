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
            { name: "Discovery", path: "discovery", description: "User personas, journey maps, and requirements analysis", enabled: true },
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

        // Programmatically generate Discovery assets (Mermaid only)
        const discoveryPath = path.join(this.targetDir, 'assets', 'discovery');
        
        const personasContent = `classDiagram
    note "Personas & Actors Definition"
    
    class User {
        +String role "General User"
        +List goals
        +List painPoints
    }

    class Administrator {
        +String role "System Admin"
        +maintainSystem()
        +manageAccess()
    }
    
    User <|-- Administrator`;

        const requirementsContent = `mindmap
  root((Requirements))
    Functional
      User Management
        [REQ-001] Registration
        [REQ-002] Login / SSO
    Non-Functional
      Performance
        [NFR-001] < 200ms API Response
      Security
        [NFR-002] Data Encryption`;

        const journeyContent = `journey
    title User Journey: Core Workflow
    section Onboarding
      Sign Up: 5: User
      Verify Email: 3: User
    section Usage
      Login: 5: User
      Dashboard: 5: User`;

        await fs.writeFile(path.join(discoveryPath, 'personas.mermaid'), personasContent);
        await fs.writeFile(path.join(discoveryPath, 'requirements.mermaid'), requirementsContent);
        await fs.writeFile(path.join(discoveryPath, 'journeys.mermaid'), journeyContent);

        console.log(chalk.gray(`Copying templates...`));
        // Check if templates exist before copying to avoid errors in dev environment vs prod
        if (await fs.pathExists(path.join(this.templateDir, 'assets'))) {
            await fs.copy(path.join(this.templateDir, 'assets'), path.join(this.targetDir, 'assets'));
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
        await this.ensureParentGitignore();
    }

    async upgrade(): Promise<void> {
        const projectDir = process.cwd();
        const configPath = path.join(projectDir, 'foundry.config.json');

        if (!await fs.pathExists(configPath)) {
            throw new Error('Not in a FoundrySpec project. Please run from the root of your project.');
        }

        console.log(chalk.gray(`Updating templates and workflows...`));

        // Overwrite core templates if they exist in source
        if (await fs.pathExists(path.join(this.templateDir, 'index.html'))) {
            await fs.copy(path.join(this.templateDir, 'index.html'), path.join(projectDir, 'index.html'), { overwrite: true });
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

    async ensureParentGitignore(): Promise<void> {
        const parentDir = path.dirname(this.targetDir);
        const gitignorePath = path.join(parentDir, '.gitignore');

        let content = '';
        if (await fs.pathExists(gitignorePath)) {
            content = await fs.readFile(gitignorePath, 'utf8');
        }

        const foundryspecRules = [
            '# FoundrySpec self-documentation build artifacts',
            '/foundryspec/dist',
            '/foundryspec/*.log',
            '/foundryspec/build-info.txt'
        ].join('\n');

        // Check if foundryspec rules are already present
        if (!content.includes('FoundrySpec self-documentation build artifacts')) {
            console.log(chalk.gray(`Adding FoundrySpec rules to parent .gitignore...`));
            content += content.endsWith('\n') ? '\n' : '\n\n';
            content += foundryspecRules + '\n';
            await fs.writeFile(gitignorePath, content);
        }
    }


}
