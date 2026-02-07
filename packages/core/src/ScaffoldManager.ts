/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU Affero General Public License v3.0 (AGPLv3).
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
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { ConfigStore } from './ConfigStore.js';
import { GitManager } from './GitManager.js';
import { CategoryTemplate } from './types/scaffold.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @foundryspec COMP_ScaffoldManager
 */
export class ScaffoldManager {
    private projectName: string;
    private targetDir: string;
    private templateDir: string;
    private configStore: ConfigStore;
    
    // Centralized source of truth for standard project categories
    private standardCategories: CategoryTemplate[] = [
        { name: "Personas", path: "personas", description: "L0: User personas and actors", enabled: true },
        { name: "Requirements", path: "requirements", description: "L0: Requirements analysis", enabled: true },
        { name: "Journeys", path: "journeys", description: "L0: User journey maps", enabled: true },
        { name: "Context", path: "context", description: "L1: System context and high-level strategy", enabled: true },
        { name: "Boundaries", path: "boundaries", description: "L2: Technical boundaries and communication", enabled: true },
        { name: "Components", path: "components", description: "L3: Internal module structure", enabled: true },
        { name: "Data Models", path: "data", description: "ER diagrams for AI collaboration", enabled: true },
        { name: "Sequences", path: "sequences", description: "Process flows for AI collaboration", enabled: true },
        { name: "Flows", path: "flows", description: "Logical workflows for AI collaboration", enabled: true },
        { name: "States", path: "states", description: "State machines for behavior modeling", enabled: true }
    ];

    constructor(projectName?: string) {
        this.projectName = projectName || 'My Spec Project';
        this.targetDir = path.resolve(process.cwd(), 'docs');
        this.templateDir = path.resolve(__dirname, '../templates');
        this.configStore = new ConfigStore();
    }

    async init(): Promise<void> {
        if (await fs.pathExists(path.join(process.cwd(), '.foundryid'))) {
            throw new Error(`Project is already initialized (found .foundryid).`);
        }

        console.log(chalk.gray(`Creating documentation structure...`));
        await fs.ensureDir(this.targetDir);
        await fs.ensureDir(path.join(this.targetDir, 'others'));

        for (const cat of this.standardCategories) {
            await fs.ensureDir(path.join(this.targetDir, cat.path));
        }

        // Copy template files from templates/scaffolds to project docs
        const scaffoldDir = path.join(this.templateDir, 'scaffolds');
        
        for (const cat of this.standardCategories) {
            const sourcePath = path.join(scaffoldDir, cat.path);
            const targetPath = path.join(this.targetDir, cat.path);
            
            if (await fs.pathExists(sourcePath)) {
                // Copy all files from the scaffold category to the project
                const files = await fs.readdir(sourcePath);
                for (const file of files) {
                    const sourceFile = path.join(sourcePath, file);
                    const targetFile = path.join(targetPath, file);
                    
                    // Skip if it's a directory (we only want files)
                    const stat = await fs.stat(sourceFile);
                    if (stat.isFile()) {
                        await fs.copyFile(sourceFile, targetFile);
                    }
                }
            }
        }

        // --- REGISTER PROJECT GLOBALLY ---
        const projectId = crypto.randomUUID();
        await this.configStore.saveProject({
            id: projectId,
            name: this.projectName,
            version: "1.0.0",
            created: new Date().toISOString(),
            categories: this.standardCategories.map(c => ({
                name: c.name,
                path: c.path,
                description: c.description
            }))
        });

        await fs.writeFile(path.join(process.cwd(), '.foundryid'), projectId.trim());
        await this.ensureGitignore(process.cwd());

        // --- INSTALL GITOPS HOOKS ---
        try {
            // Using process.cwd() as root since we are in init
            const gitMan = new GitManager(process.cwd());
            await gitMan.installHooks();
        } catch (err: unknown) {
            console.warn(chalk.yellow(`\n⚠️  Could not install Git hooks (is this a git repo?): ${err}`));
        }
    }

    async ensureGitignore(dir: string): Promise<void> {
        const gitignorePath = path.join(dir, '.gitignore');
        let content = '';
        if (await fs.pathExists(gitignorePath)) {
            content = await fs.readFile(gitignorePath, 'utf8');
        }

        const ignores = ['dist', '.foundryspec/dist', 'foundryspec-debug.log', '.foundry'];
        let updated = false;

        for (const ignore of ignores) {
            if (!content.includes(ignore)) {
                content += content.endsWith('\n') ? `${ignore}\n` : `\n${ignore}\n`;
                updated = true;
            }
        }

        if (updated) {
            console.log(chalk.gray(`Updating .gitignore...`));
            await fs.writeFile(gitignorePath, content);
        }
    }

    async upgrade(): Promise<void> {
       console.log(chalk.yellow("Upgrade for legacy projects to Global Config is not yet implemented."));
    }
}