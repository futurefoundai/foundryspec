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
        const reqDir = path.join(this.targetDir, 'discovery', 'requirements');
        await fs.ensureDir(reqDir);

        const coreReqContent = `---
title: Core Requirements
description: Fundamental system requirements.
id: "REQ_Core"
uplink: "PER_User"
downlinks:
  - "CTX_System"
---
requirementDiagram
    requirement Fundamental {
        id: "REQ_Core"
        text: "The system shall perform its core functions."
        risk: Low
        verifymethod: Test
    }
`;
        await fs.writeFile(path.join(reqDir, 'REQ_Core.mermaid'), coreReqContent);

        // --- 3. Journey ---
        const journeyDir = path.join(this.targetDir, 'discovery', 'journeys');
        await fs.ensureDir(journeyDir);
        
        const journeyContent = `---
title: User Workflow
description: Core user interaction flow.
id: "JRN_UserWorkflow"
uplink: "PER_User"
---
sequenceDiagram
    autonumber
    actor User
    participant System

    rect rgb(240, 255, 240)
    Note right of User: Happy Path: Core Workflow
    
    User->>System: Login(credentials)
    System-->>User: 200 OK (Auth Token)

    User->>System: Perform Action(data)
    System->>System: Validate & Process
    System-->>User: 200 OK (Success)
    end
`;
        await fs.writeFile(path.join(journeyDir, 'JRN_UserWorkflow.mermaid'), journeyContent);

        // --- 4. Context (L1) ---
        const contextPath = path.join(this.targetDir, 'context');
        const systemContextContent = `---
title: System Context Diagram (L1)
description: High-level system landscape.
id: "CTX_Main"
---
graph TD
    User((User)) --> CTX_System((${this.projectName}))
`;
        await fs.writeFile(path.join(contextPath, 'context.mermaid'), systemContextContent);

        // --- 5. Boundaries (L2) ---
        const boundariesPath = path.join(this.targetDir, 'boundaries');
        const boundariesContent = `---
title: Technical Boundaries Diagram (L2)
description: Boundary decomposition.
id: "BND_Main"
---
graph TD
    subgraph CTX_System [${this.projectName}]
        BND_App(Main Application)
    end
`;
        await fs.writeFile(path.join(boundariesPath, 'boundaries.mermaid'), boundariesContent);

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