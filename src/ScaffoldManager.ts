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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface CategoryTemplate {
    name: string;
    path: string;
    description: string;
    enabled: boolean;
}

/**
 * @foundryspec COMP_Group
 */
export class ScaffoldManager {
    private projectName: string;
    private targetDir: string;
    private templateDir: string;
    private configStore: ConfigStore;
    
    // Centralized source of truth for standard project categories
    private standardCategories: CategoryTemplate[] = [
        { name: "Discovery", path: "discovery", description: "L0: User personas, journey maps, and requirements analysis", enabled: true },
        { name: "Context", path: "context", description: "L1: System context and high-level strategy", enabled: true },
        { name: "Boundaries", path: "boundaries", description: "L2: Technical boundaries and communication", enabled: true },
        { name: "Components", path: "components", description: "L3: Internal module structure", enabled: true }
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

        // --- 1. Personas (Atomic Mindmaps) ---
        const personaDir = path.join(this.targetDir, 'discovery', 'personas');
        await fs.ensureDir(personaDir);

        const endUserContent = `--- 
title: End User
description: The primary actor interacting with the system.
id: "PER_EndUser"
---
mindmap
  PER_EndUser((End User))
    Role
      Human Actor
    Description
      The primary user interacting with the system to achieve specific objectives.
    Goals
      Complete tasks efficiently
      Interact with the UI/API
`;

        const stakeholderContent = `--- 
title: Stakeholder
description: Business or technical leaders who define success criteria.
id: "PER_Stakeholder"
---
mindmap
  PER_Stakeholder((Stakeholder))
    Role
      Influencer
    Description
      Business or technical leaders who define success criteria for the project.
    Goals
      Ensure project success
      Minimize overhead
      Drive strategy
`;
        await fs.writeFile(path.join(personaDir, 'PER_EndUser.mermaid'), endUserContent);
        await fs.writeFile(path.join(personaDir, 'PER_Stakeholder.mermaid'), stakeholderContent);

        // --- 2. Requirements ---
        const discoveryPath = path.join(this.targetDir, 'discovery');
        const requirementsContent = `--- 
title: Requirements Catalog
description: Index of system requirements.
id: "GRP_Requirements"
---
mindmap
  GRP_Requirements(Requirements)
    GRP_Core(Core Requirements)
`;
        await fs.writeFile(path.join(discoveryPath, 'requirements.mermaid'), requirementsContent);

        // --- 3. Journey ---
        const journeyContent = `--- 
title: User Journey
description: High-level workflow visualization.
id: "GRP_Journeys"
uplink: "PER_EndUser"
---
journey
    title User Journey: [Workflow Name]
    section [Phase Name]
      [Action]: 5: PER_EndUser
`;
        await fs.writeFile(path.join(discoveryPath, 'journeys.mermaid'), journeyContent);

        // --- 4. Context (L1) ---
        const contextPath = path.join(this.targetDir, 'context');
        const systemContextContent = `--- 
title: System Context Diagram (L1)
description: High-level system landscape.
id: "CTX_Main"
---
C4Context
    title System Context Diagram (L1)

    Person(user, "User", "A user of the system")
    System(CTX_System, "${this.projectName}", "The software system being built")
    
    Rel(user, CTX_System, "Uses")
`;
        await fs.writeFile(path.join(contextPath, 'system-context.mermaid'), systemContextContent);

        // --- 5. Boundaries (L2) ---
        const boundariesPath = path.join(this.targetDir, 'boundaries');
        const boundariesContent = `--- 
title: Technical Boundaries Diagram (L2)
description: Boundary decomposition.
id: "BND_Main"
---
C4Container
    title Technical Boundaries Diagram (L2)

    System_Boundary(system, "${this.projectName}") {
        Container(BND_App, "Main Application", "Technology Stack", "Core business logic")
    }
`;
        await fs.writeFile(path.join(boundariesPath, 'technical-boundaries.mermaid'), boundariesContent);

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
    }

    async ensureGitignore(dir: string): Promise<void> {
        const gitignorePath = path.join(dir, '.gitignore');
        let content = '';
        if (await fs.pathExists(gitignorePath)) {
            content = await fs.readFile(gitignorePath, 'utf8');
        }

        const ignores = ['dist', '.foundryspec/dist', 'foundryspec-debug.log'];
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