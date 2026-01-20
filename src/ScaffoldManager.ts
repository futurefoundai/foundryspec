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

        const userContent = `--- 
title: Standard User
description: A typical end-user of the system.
id: "PER_User"
---
mindmap
  PER_User((Standard User))
    Role
      End User
    Description
      A typical end-user interacting with the system's core features.
    Goals
      Access public features
      Manage personal data
      Perform core workflows
`;

        const adminContent = `--- 
title: System Admin
description: Privileged user responsible for system management.
id: "PER_Admin"
---
mindmap
  PER_Admin((System Admin))
    Role
      Administrator
    Description
      Privileged user responsible for user management, configuration, and system oversight.
    Goals
      Manage user accounts
      Configure system settings
      Monitor system health
`;
        await fs.writeFile(path.join(personaDir, 'PER_User.mermaid'), userContent);
        await fs.writeFile(path.join(personaDir, 'PER_Admin.mermaid'), adminContent);

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
uplink: "PER_User"
---
journey
    title User Journey: Core Workflow
    section Initialization
      Login: 5: PER_User
      Load Dashboard: 3: System
    section Action
      Perform Task: 5: PER_User
      Save Data: 3: System
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