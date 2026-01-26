#!/usr/bin/env node
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

import { Command } from 'commander';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { ConfigStore } from './ConfigStore.js';
import { bootstrap } from './bootstrap.js';

// Import Command Modules
import { registerCoreCommands } from './commands/CoreCommands.js';
import { registerGitOpsCommands } from './commands/GitOpsCommands.js';
import { registerGovernanceCommands } from './commands/GovernanceCommands.js';
import { registerConfigCommands } from './commands/ConfigCommands.js';

/**
 * @foundryspec COMP_CLI
 * Finds the project root by searching for .foundryid or legacy foundry.config.json.
 */
async function findProjectRoot(startDir: string): Promise<string> {
    // Naive check for now: assumes command running in root
    return startDir; 
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = fs.readJsonSync(path.join(__dirname, '../package.json'));

// Main async entry point
async function main() {
    // Bootstrap DI container and load plugins
    const container = await bootstrap();
    const store = container.resolve<ConfigStore>('ConfigStore');

    const program = new Command();

    program
        .name('foundryspec')
        .description('Documentation engine for human-AI collaborative system analysis and design')
        .version(packageJson.version);

    // Register Modules (pass container where needed)
    registerCoreCommands(program, findProjectRoot, container);
    registerGitOpsCommands(program, findProjectRoot);
    registerGovernanceCommands(program, store);
    registerConfigCommands(program, store);

    program.parse();
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
