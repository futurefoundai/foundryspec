import { simpleGit, SimpleGit } from 'simple-git';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

interface ExternalSpec {
    remote: string;
    target: string;
    branch: string;
}

interface FoundryConfig {
    projectName: string;
    version: string;
    categories: any[];
    external: ExternalSpec[];
    build: any;
}

export class GitManager {
    private projectDir: string;
    private configPath: string;
    private git: SimpleGit;

    constructor(projectDir: string = process.cwd()) {
        this.projectDir = projectDir;
        this.configPath = path.join(this.projectDir, 'foundry.config.json');
        this.git = simpleGit(this.projectDir);
    }

    async pull(remoteUrl: string, targetPath: string): Promise<void> {
        if (!await fs.pathExists(this.configPath)) {
            throw new Error('foundry.config.json not found.');
        }

        const config: FoundryConfig = await fs.readJson(this.configPath);
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
        if (!config.external) config.external = [];
        const existing = config.external.find(e => e.remote === remoteUrl);
        if (!existing) {
            config.external.push({
                remote: remoteUrl,
                target: targetPath,
                branch: 'main'
            });
            await fs.writeJson(this.configPath, config, { spaces: 2 });
        }

        console.log(chalk.green(`✅ Successfully integrated remote specs.`));
    }

    async sync(): Promise<void> {
        if (!await fs.pathExists(this.configPath)) {
            throw new Error('foundry.config.json not found.');
        }

        const config: FoundryConfig = await fs.readJson(this.configPath);
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
}
