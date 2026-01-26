/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU Affero General Public License v3.0 (AGPLv3).
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// @foundryspec/start COMP_GitManager
export class GitManager {
    private projectRoot: string;

    constructor(projectRoot: string = process.cwd()) {
        this.projectRoot = path.resolve(projectRoot);
    }

    async installHooks(): Promise<void> {
        console.log(chalk.blue('🛡️  Installing FoundrySpec GitOps Hooks...'));

        const gitDir = path.join(this.projectRoot, '.git');
        if (!await fs.pathExists(gitDir)) {
            throw new Error('Not a git repository. Run "git init" first.');
        }

        const hooksDir = path.join(gitDir, 'hooks');
        await fs.ensureDir(hooksDir);

        const templatePath = path.resolve(__dirname, '../templates/hooks/pre-commit');
        const targetPath = path.join(hooksDir, 'pre-commit');

        if (!await fs.pathExists(templatePath)) {
            throw new Error('Hook template not found. Please reinstall FoundrySpec.');
        }

        const templateContent = await fs.readFile(templatePath, 'utf8');
        await fs.writeFile(targetPath, templateContent);
        
        // Make executable (chmod +x)
        await fs.chmod(targetPath, '755');

        console.log(chalk.gray('   This hook will now run "foundryspec probe" and "foundryspec build" before every commit.'));
    }

    async installCI(): Promise<void> {
        console.log(chalk.blue('☁️  Scaffolding FoundrySpec CI Workflow...'));

        const workflowsDir = path.join(this.projectRoot, '.github/workflows');
        await fs.ensureDir(workflowsDir);

        const templatePath = path.resolve(__dirname, '../templates/ci/standard-check.yml');
        const targetPath = path.join(workflowsDir, 'foundryspec-check.yml');

        if (!await fs.pathExists(templatePath)) {
            // Fallback content if template missing (e.g. dev environment)
            const fallbackContent = `name: FoundrySpec Integrity
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install
      - run: npx foundryspec probe
      - run: npx foundryspec build
`;
            await fs.writeFile(targetPath, fallbackContent);
        } else {
            const content = await fs.readFile(templatePath, 'utf8');
            await fs.writeFile(targetPath, content);
        }

        console.log(chalk.green('✅ GitHub Action created at .github/workflows/foundryspec-check.yml'));
        console.log(chalk.gray('   Push this file to enforce integrity checks on Pull Requests.'));
    }

    // --- Legacy / Sync Methods (Stubs for now) ---
    async pull(url: string, targetPath: string): Promise<void> {
        console.log(chalk.yellow(`⚠️  Git Pull not fully implemented. URL: ${url}, Path: ${targetPath}`));
    }

    async sync(): Promise<void> {
        console.log(chalk.yellow('⚠️  Git Sync not fully implemented in this version.'));
    }

    async getSpecChanges(days: number): Promise<unknown[]> { // Using unknown[] to avoid circular dependency
        console.log(chalk.yellow(`⚠️  Change detection stub. Days: ${days}`));
        return [];
    }
}
// @foundryspec/end
