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
        // Changed: docs/ folder instead of foundryspec/
        this.targetDir = path.resolve(process.cwd(), 'docs');
        this.templateDir = path.resolve(__dirname, '../templates');
        this.configStore = new ConfigStore();
    }

    async init(): Promise<void> {
        // Check for .foundryid to avoid re-initializing
        if (await fs.pathExists(path.join(process.cwd(), '.foundryid'))) {
            throw new Error(`Project is already initialized (found .foundryid).`);
        }

        if (await fs.pathExists(this.targetDir)) {
            console.log(chalk.yellow(`Directory "docs" already exists. We will populate it with standard folders if missing.`));
        }

        console.log(chalk.gray(`Creating directory structure...`));
        await fs.ensureDir(this.targetDir);
        await fs.ensureDir(path.join(this.targetDir, 'others'));

        for (const cat of this.standardCategories) {
            // Flattened structure: docs/discovery instead of docs/assets/discovery
            await fs.ensureDir(path.join(this.targetDir, cat.path));
        }

        // Programmatically generate Discovery assets (Mermaid only)
        const discoveryPath = path.join(this.targetDir, 'discovery');
        
        const personasContent = `---
title: Personas
description: Actors and roles within the ecosystem.
traceability:
  id: "GRP_Personas"
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
  id: "GRP_Requirements"
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
  id: "GRP_Journeys"
  uplink: "PER_EndUser"
---
journey
    title User Journey: [Workflow Name]
    section [Phase Name]
      [Action]: 5: [Actor]
      [System Response]: 3: System`;

        await fs.writeFile(path.join(discoveryPath, 'personas.mermaid'), personasContent);
        await fs.writeFile(path.join(discoveryPath, 'requirements.mermaid'), requirementsContent);
        await fs.writeFile(path.join(discoveryPath, 'journeys.mermaid'), journeyContent);

        // --- Generate L1 (Context) Assets ---
        const contextPath = path.join(this.targetDir, 'context');
        const systemContextContent = `---
title: System Context Diagram (L1)
description: High-level system landscape.
traceability:
  id: "CTX_Main"
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
        const boundariesPath = path.join(this.targetDir, 'boundaries');
        const boundariesContent = `---
title: Technical Boundaries Diagram (L2)
description: Boundary decomposition.
traceability:
  id: "BND_Main"
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
        const componentsPath = path.join(this.targetDir, 'components');
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

        // --- Generate Root Map (Directly in docs/) ---
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
        // TODO: Categories will be removed because it should be automatically detected in build 

        // --- WRITE LINK FILE ---
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

    // Unchanged, but kept for compatibility validation if needed
    async upgrade(): Promise<void> {
       // Only upgrade logic if we detect old structure, but for now we focus on new structure.
       // TODO: Implement migration logic from old structure to new structure if requested.
       console.log(chalk.yellow("Upgrade for legacy projects to Global Config is not yet implemented."));
    }
}

