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
    
    // Centralized source of truth for standard project categories
    private standardCategories: CategoryTemplate[] = [
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

    constructor(projectName?: string) {
        this.projectName = projectName || 'My Spec Project';
        this.targetDir = path.resolve(process.cwd(), 'foundryspec');
        this.templateDir = path.resolve(__dirname, '../templates');
    }

    async init(): Promise<void> {
        if (await fs.pathExists(this.targetDir)) {
            throw new Error(`Directory "foundryspec" already exists. Move it or use a different location.`);
        }

        console.log(chalk.gray(`Creating directory structure...`));
        await fs.ensureDir(this.targetDir);

        for (const cat of this.standardCategories) {
            await fs.ensureDir(path.join(this.targetDir, 'assets', cat.path));
        }

        // Programmatically generate Discovery assets (Mermaid only)
        const discoveryPath = path.join(this.targetDir, 'assets', 'discovery');
        
        const personasContent = `classDiagram
    note "Define your actors and personas here"
    %% class User {
    %%    +String role
    %%    +List goals
    %% }`;

        const requirementsContent = `requirementDiagram

    requirement Functional {
        id: "1"
        text: "Functional Requirements"
        risk: Low
        verifymethod: Test
    }

    requirement Feature_A {
        id: "1.1"
        text: "Description of specific feature"
        risk: Low
        verifymethod: Test
    }

    requirement Non_Functional {
        id: "2"
        text: "Non-Functional Requirements"
        risk: Low
        verifymethod: Test
    }

    Functional -contains-> Feature_A`;

        const journeyContent = `journey
    title User Journey: [Workflow Name]
    section [Phase Name]
      [Action]: 5: [Actor]
      [System Response]: 3: System`;

        const traceabilityContent = `requirementDiagram
    %% Traceability Matrix: Links Requirements to Components
    
    requirement Req_Sample {
        id: "REQ-001"
        text: "Sample Functional Requirement"
    }

    requirement Comp_Sample {
        id: "COMP-001"
        text: "Source Code / Component Reference"
    }

    Comp_Sample -satisfies-> Req_Sample`;

        await fs.writeFile(path.join(discoveryPath, 'personas.mermaid'), personasContent);
        await fs.writeFile(path.join(discoveryPath, 'requirements.mermaid'), requirementsContent);
        await fs.writeFile(path.join(discoveryPath, 'journeys.mermaid'), journeyContent);

        const config = {
            projectName: this.projectName,
            version: "1.0.0",
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

        console.log(chalk.gray(`Checking for structural updates...`));

        // 1. Ensure all standard category folders exist
        for (const cat of this.standardCategories) {
            const catPath = path.join(projectDir, 'assets', cat.path);
            if (!await fs.pathExists(catPath)) {
                console.log(chalk.gray(`Creating missing category folder: assets/${cat.path}`));
                await fs.ensureDir(catPath);
            }
        }

        // 2. Ensure Discovery assets exist (onboarding old projects)
        const discoveryPath = path.join(projectDir, 'assets', 'discovery');

        const personasPath = path.join(discoveryPath, 'personas.mermaid');
        if (!await fs.pathExists(personasPath)) {
            console.log(chalk.gray(`Adding missing Discovery asset: personas.mermaid`));
            await fs.writeFile(personasPath, `classDiagram\n    note "Define your actors and personas here"\n    %% class User { ... }`);
        }

        const requirementsPath = path.join(discoveryPath, 'requirements.mermaid');
        if (!await fs.pathExists(requirementsPath)) {
            console.log(chalk.gray(`Adding missing Discovery asset: requirements.mermaid`));
            await fs.writeFile(requirementsPath, `requirementDiagram\n    requirement R1 {\n        id: "1"\n        text: "Describe the requirement here"\n        risk: Low\n        verifymethod: Test\n    }`);
        }

        const journeysPath = path.join(discoveryPath, 'journeys.mermaid');
        if (!await fs.pathExists(journeysPath)) {
            console.log(chalk.gray(`Adding missing Discovery asset: journeys.mermaid`));
            await fs.writeFile(journeysPath, `journey\n    title User Journey: [Name]\n    section [Phase]\n      [Action]: 5: [Actor]`);
        }

        // 2. Ensure .gitignore rules
        await this.ensureGitignore(projectDir);
        
        console.log(chalk.green(`\n✅ Project structure is up to date with the latest FoundrySpec standards.`));
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
