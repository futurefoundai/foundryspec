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

/**
 * @foundryspec COMP_Group
 */
export class ScaffoldManager {
    private projectName: string;
    private targetDir: string;
    private templateDir: string;
    
    // Centralized source of truth for standard project categories
    private standardCategories: CategoryTemplate[] = [
        { name: "Discovery", path: "discovery", description: "L0: User personas, journey maps, and requirements analysis", enabled: true },
        { name: "Context", path: "context", description: "L1: System context and high-level strategy", enabled: true },
        { name: "Boundaries", path: "boundaries", description: "L2: Technical boundaries and communication", enabled: true },
        { name: "Components", path: "components", description: "L3: Internal module structure", enabled: true },
        { name: "Sequences", path: "sequences", description: "Interaction flows and logic progression", enabled: false },
        { name: "States", path: "states", description: "State machine logic and data lifecycle", enabled: false },
        { name: "Data", path: "data", description: "Schema, contracts, and persistence", enabled: false },
        { name: "Design", path: "design", description: "UI/UX mocks, wireframes, and style guides", enabled: false },
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
        
        const personasContent = `---
title: Personas
description: Actors and roles within the ecosystem.
traceability:
  # Root Layer (L0) - No Uplinks
  entities:
    - id: "PER_EndUser"
    - id: "PER_Stakeholder"
---
%% The Four Persona Types:
%% 1. The End-User Persona (The "Actor"): Interact with UI/API. Drives L3 Component design (UX, Latency, Accessibility).
%% 2. The Stakeholder Persona (The "Influencer"): Define success (CTO, PM). Drives L1 Context (Strategy, Overhead).
%% 3. The Regulatory Persona (The "Guardian"): Legal/Compliance (GDPR, SOC2). Drives L2 Boundaries (Isolation, Security).
%% 4. The System Persona (The "Proxy"): External systems (Mainframes, Gateways). Drives L3 Interfaces (Protocols, Formats).

classDiagram
    class PER_EndUser {
        <<Actor>>
        +Goal: Achieve personal/pro objectives
    }
    class PER_Stakeholder {
        <<Influencer>>
        +Goal: Business success
    }
`;

        const requirementsContent = `---
title: Functional Requirements
description: Core system capabilities.
traceability:
  id: "REQ_Group"
  relationships:
    - id: "REQ_Functional"
      uplink: "PER_EndUser"
---
requirementDiagram

    requirement Functional {
        id: "REQ_Functional"
        text: "The system shall provide X..."
        risk: Low
        verifymethod: Test
    }

    requirement Feature_A {
        id: "REQ_FeatA"
        text: "Specific feature detail"
        risk: Low
        verifymethod: Test
    }

    requirement Non_Functional {
        id: "REQ_NonFunctional"
        text: "Non-Functional Requirements"
        risk: Low
        verifymethod: Test
    }

    Functional -contains-> Feature_A`;

        const journeyContent = `---
title: User Journey
description: High-level workflow visualization.
traceability:
  uplink: "PER_EndUser"
---
journey
    title User Journey: [Workflow Name]
    section [Phase Name]
      [Action]: 5: [Actor]
      [System Response]: 3: System`;

        // Note: Traceability matrix diagram removed as it's now handled by Frontmatter logic

        await fs.writeFile(path.join(discoveryPath, 'personas.mermaid'), personasContent);
        await fs.writeFile(path.join(discoveryPath, 'requirements.mermaid'), requirementsContent);
        await fs.writeFile(path.join(discoveryPath, 'journeys.mermaid'), journeyContent);

        // --- Generate L1 (Context) Assets ---
        const contextPath = path.join(this.targetDir, 'assets', 'context');
        const systemContextContent = `---
title: System Context Diagram (L1)
description: High-level system landscape.
traceability:
  relationships:
    - id: "CTX_System"
      uplink: "REQ_Functional"
---
C4Context
    title System Context Diagram (L1)

    Person(user, "User", "A user of the system")
    System(CTX_System, "${this.projectName}", "The software system being built")
    System_Ext(external, "External System", "An external dependency")

    Rel(user, CTX_System, "Uses")
    Rel(CTX_System, external, "Connects to")`;
        
        await fs.writeFile(path.join(contextPath, 'system-context.mermaid'), systemContextContent);

        // --- Generate L2 (Boundaries) Assets ---
        const boundariesPath = path.join(this.targetDir, 'assets', 'boundaries');
        const boundariesContent = `---
title: Technical Boundaries Diagram (L2)
description: Boundary decomposition.
traceability:
  relationships:
    - id: "BND_App"
      uplink: "CTX_System"
---
C4Container
    title Technical Boundaries Diagram (L2)

    System_Boundary(system, "${this.projectName}") {
        Container(BND_App, "Main Application", "Technology Stack", "Core business logic")
        ContainerDb(db, "Data Store", "Persistence Technology", "Storage")
    }

    Rel(BND_App, db, "Reads/Writes", "Protocol")`;

        await fs.writeFile(path.join(boundariesPath, 'technical-boundaries.mermaid'), boundariesContent);

        // --- Generate L3 (Components) Assets ---
        const componentsPath = path.join(this.targetDir, 'assets', 'components');
        const componentContent = `---
title: Example Component
description: A sample component definition.
traceability:
  id: "COMP_Example"
  uplink: "BND_App"
---
# Example Component (L3)

## Overview
This component demonstrates the ID-based traceability chain.

## Traceability
- **ID:** \`COMP_Example\`
- **Uplink:** Satisfies Boundary [\`BND_App\`](../boundaries/technical-boundaries.mermaid)

## Interface
...
`;
        await fs.writeFile(path.join(componentsPath, 'example-component.md'), componentContent);

        // --- Generate Root Map ---
        const rootContent = `---
title: Project Root
description: The entry point for the documentation graph.
traceability:
  id: "ROOT"
  downlinks:
    - "PER_EndUser"
    - "PER_Stakeholder"
    - "REQ_Functional"
    - "CTX_System"
    - "BND_App"
    - "COMP_Example"
---
mindmap
        root((${this.projectName}))
            :::root
            L0(Discovery)
                :::l0
                Personas
                Requirements
                Journeys
            L1(Context)
                :::l1
                System Context
            L2(Boundaries)
                :::l2
                Technical Boundaries
            L3(Components)
                :::l3
                Components`;

        await fs.writeFile(path.join(this.targetDir, 'root.mermaid'), rootContent);

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
            await fs.writeFile(personasPath, `%% The Four Persona Types:\n%% 1. End-User (Actor) -> L3 UX\n%% 2. Stakeholder (Influencer) -> L1 Context\n%% 3. Regulatory (Guardian) -> L2 Boundaries\n%% 4. System (Proxy) -> L3 Interfaces\n\nclassDiagram\n    class EndUser { <<Actor>> }`);
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

        // 3. Ensure L1/L2 assets exist
        const contextPath = path.join(projectDir, 'assets', 'context');
        const contextFile = path.join(contextPath, 'system-context.mermaid');
        if (await fs.pathExists(contextPath) && !await fs.pathExists(contextFile)) {
             console.log(chalk.gray(`Adding missing L1 asset: system-context.mermaid`));
             await fs.writeFile(contextFile, `C4Context\n    title System Context (L1)\n    System(system, "System", "Description")`);
        }

        const boundariesPath = path.join(projectDir, 'assets', 'boundaries');
        const boundariesFile = path.join(boundariesPath, 'technical-boundaries.mermaid');
        if (await fs.pathExists(boundariesPath) && !await fs.pathExists(boundariesFile)) {
             console.log(chalk.gray(`Adding missing L2 asset: technical-boundaries.mermaid`));
             await fs.writeFile(boundariesFile, `C4Container\n    title Technical Boundaries (L2)\n    Container(app, "Application", "Tech", "Description")`);
        }
        
        // 4. Update root.mermaid if it seems outdated (simple check)
        const rootPath = path.join(projectDir, 'root.mermaid');
        if (await fs.pathExists(rootPath)) {
            const rootContent = await fs.readFile(rootPath, 'utf8');
            if (!rootContent.includes('L1: Context') && !rootContent.includes('L2: Boundaries')) {
                console.log(chalk.yellow(`\n⚠️  Notice: Your root.mermaid uses the old structure.`));
                console.log(chalk.yellow(`   Consider updating it to include L0-L3 layers: Discovery, Context, Boundaries, Components.`));
            }
        } else {
             console.log(chalk.gray(`Creating missing root.mermaid...`));
             await fs.writeFile(rootPath, `mindmap\n    root((Project))\n        L0: Discovery\n        L1: Context\n        L2: Boundaries\n        L3: Components\n        Peripherals`);
        }

        // 5. Ensure .gitignore rules
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
