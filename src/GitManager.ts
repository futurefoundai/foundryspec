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

import { simpleGit, SimpleGit } from 'simple-git';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

import { ConfigStore } from './ConfigStore.js';

import { FileChange } from './types/git.js';

/**
 * @foundryspec COMP_GitManager
 */
export class GitManager {
    private projectDir: string;
    private git: SimpleGit;
    private configStore: ConfigStore;

    constructor(projectDir: string = process.cwd()) {
        this.projectDir = projectDir;
        this.git = simpleGit(this.projectDir);
        this.configStore = new ConfigStore();
    }

    private async getProjectId(): Promise<string> {
        const idPath = path.join(this.projectDir, '.foundryid');
        if (!await fs.pathExists(idPath)) {
            throw new Error('Project not initialized. No .foundryid found. Run "foundryspec init".');
        }
        return (await fs.readFile(idPath, 'utf8')).trim();
    }

    async pull(remoteUrl: string, targetPath: string): Promise<void> {
        const projectId = await this.getProjectId();
        const config = await this.configStore.getProject(projectId);
        
        if (!config) throw new Error(`Project ${projectId} not found in configuration.`);

        const fullTargetPath = path.resolve(this.projectDir, targetPath);

        console.log(chalk.gray(`Pulling remote specs from ${remoteUrl} to ${targetPath}...`));

        if (await fs.pathExists(fullTargetPath)) {
            console.log(chalk.gray(`Target path exists, updating...`));
            const subGit = simpleGit(fullTargetPath);
            await subGit.pull();
        } else {
            await fs.ensureDir(path.dirname(fullTargetPath));
            await this.git.clone(remoteUrl, fullTargetPath);
        }

        // Update config
        const external = config.external || [];
        const existing = external.find(e => e.remote === remoteUrl);
        if (!existing) {
            external.push({
                remote: remoteUrl,
                target: targetPath,
                branch: 'main'
            });
            await this.configStore.updateProject(projectId, { external });
        }

        console.log(chalk.green(`✅ Successfully integrated remote specs.`));
    }

    async sync(): Promise<void> {
        const projectId = await this.getProjectId();
        const config = await this.configStore.getProject(projectId);
        
        if (!config) throw new Error(`Project ${projectId} not found in configuration.`);

        if (!config.external || config.external.length === 0) {
            console.log(chalk.yellow('No external specs configured to sync.'));
            return;
        }

        for (const ext of config.external) {
            console.log(chalk.gray(`Syncing ${ext.remote}...`));
            const fullTargetPath = path.resolve(this.projectDir, ext.target);
            if (await fs.pathExists(fullTargetPath)) {
                const subGit = simpleGit(fullTargetPath);
                await subGit.pull();
            } else {
                console.log(chalk.yellow(`Warning: Target path ${ext.target} missing. Re-cloning...`));
                await this.git.clone(ext.remote, fullTargetPath);
            }
        }
        console.log(chalk.green(`✅ All external specs synchronized.`));
    }

    async getSpecChanges(days: number = 7): Promise<FileChange[]> {
        try {
            // Check if directory is a git repo
            const isRepo = await this.git.checkIsRepo();
            if (!isRepo) {
                console.log(chalk.yellow('Not a git repository. Change tracking disabled.'));
                return [];
            }

            // Get names of changed files in assets directory over last N days
            const sinceDate = new Date();
            sinceDate.setDate(sinceDate.getDate() - days);

            const logOptions = [
                `--since=${sinceDate.toISOString()}`,
                '--',
                'assets'
            ];

            const logs = await this.git.log(logOptions);
            const fileChanges: Record<string, FileChange> = {};

            for (const entry of logs.all) {
                // For each commit, find which files in assets were changed
                const showResult = await this.git.show(['--name-only', '--format=', entry.hash]);
                const files = showResult.split('\n');

                const gitRoot = await this.git.revparse(['--show-toplevel']);

                for (const file of files) {
                    const fileAbsolutePath = path.join(gitRoot, file);
                    const reportPath = path.relative(this.projectDir, fileAbsolutePath);

                    if (!reportPath.startsWith('assets')) continue;

                    if (!fileChanges[reportPath]) {
                        fileChanges[reportPath] = {
                            file: reportPath,
                            commits: []
                        };
                    }
                    fileChanges[reportPath].commits.push({
                        hash: entry.hash,
                        date: entry.date,
                        message: entry.message,
                        author: entry.author_name
                    });
                }
            }

            return Object.values(fileChanges);
        } catch (err: unknown) {
            console.error(chalk.red('Error fetching git changes:'), err);
            return [];
        }
    }
}
