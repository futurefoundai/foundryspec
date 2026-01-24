import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { ConfigStore } from '../ConfigStore.js';
import { ScaffoldManager } from '../ScaffoldManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function registerConfigCommands(program: Command, store: ConfigStore) {
    program
        .command('config')
        .description('Manage project configuration (show, set)')
        .argument('<action>', 'Action to perform: show, set')
        .argument('[key]', 'Config key (e.g., name)')
        .argument('[value]', 'Value to set')
        .action(async (action, key, value) => {
            try {
                const root = process.cwd();
                const idPath = path.join(root, '.foundryid');
                if (!await fs.pathExists(idPath)) {
                    throw new Error('No .foundryid found. Run this command in the project root.');
                }
                const id = (await fs.readFile(idPath, 'utf8')).trim();

                if (action === 'show') {
                    const config = await store.getProject(id);
                    console.log(JSON.stringify(config, null, 2));
                } else if (action === 'set') {
                    if (!key || !value) throw new Error('Usage: config set <key> <value>');
                    await store.updateProject(id, { [key]: value });
                    console.log(chalk.green(`✅ Updated ${key} to "${value}" for project ${id}.`));
                } else {
                    console.log(chalk.yellow('Unknown action. Use "show" or "set".'));
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(chalk.red('\n❌ Config error:'), msg);
            }
        });

    program
        .command('comments')
        .description('Manage internal comments (dump, import)')
        .argument('<action>', 'Action to perform: dump, import')
        .argument('[file]', 'File path for import')
        .action(async (action, file) => {
            try {
                const root = process.cwd();
                const idPath = path.join(root, '.foundryid');
                if (!await fs.pathExists(idPath)) throw new Error('No .foundryid found.');
                const id = (await fs.readFile(idPath, 'utf8')).trim();
                const commentsPath = store.getCommentsPath(id);

                if (action === 'dump') {
                    if (await fs.pathExists(commentsPath)) {
                        const content = await fs.readFile(commentsPath, 'utf8');
                        console.log(content);
                    } else {
                        console.log('{}'); // Empty JSON
                    }
                } else if (action === 'import') {
                    if (!file) throw new Error('Usage: comments import <file>');
                    const source = path.resolve(file);
                    if (!await fs.pathExists(source)) throw new Error(`File not found: ${source}`);
                    
                    await fs.ensureDir(path.dirname(commentsPath));
                    await fs.copy(source, commentsPath);
                    console.log(chalk.green(`✅ Comments imported from ${file}`));
                } else if (action === 'resolve') {
                    if (!file) throw new Error('Usage: comments resolve <comment-id>');
                    if (!await fs.pathExists(commentsPath)) throw new Error('No comments found.');
                    
                    const registry = await fs.readJson(commentsPath);
                    let found = false;
                    
                    for (const key in registry) {
                        const comments = registry[key];
                        const comment = comments.find((c: { id: string }) => c.id === file);
                        if (comment) {
                            comment.status = 'resolved';
                            found = true;
                            break;
                        }
                    }
                    
                    if (found) {
                        await fs.writeJson(commentsPath, registry, { spaces: 2 });
                        console.log(chalk.green(`✅ Comment ${file} marked as resolved.`));
                    } else {
                        console.log(chalk.red(`❌ Comment ID "${file}" not found.`));
                    }
                } else {
                    console.log(chalk.yellow('Unknown action. Use "dump", "import", or "resolve".'));
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(chalk.red('\n❌ Comments error:'), msg);
            }
        });

    program
        .command('upgrade')
        .description('Update local project templates and workflows')
        .action(async () => {
            console.log(chalk.blue('\n🆙 Upgrading local FoundrySpec project...'));
            try {
                const scaffold = new ScaffoldManager();
                await scaffold.upgrade();
                console.log(chalk.green('\n✅ Project upgraded successfully!'));
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(chalk.red('\n❌ Upgrade failed:'), msg);
            }
        });

    program
        .command('help')
        .description('Display the AI Agent Guide or Workflows. Usage: help [topic] (topic: agent, workflows, or <workflow-name>)')
        .argument('[topic]', 'Topic to display: "agent" (default), "workflows", or a specific workflow filename', 'agent')
        .action(async (topic: string) => {
            try {
                const templateDir = path.resolve(__dirname, '../../templates');
                
                if (topic === 'workflows') {
                    const workflowsDir = path.join(templateDir, 'workflows');
                    if (await fs.pathExists(workflowsDir)) {
                        const files = await fs.readdir(workflowsDir);
                        console.log(chalk.blue('\nAvailable Workflows:'));
                        files.forEach(f => console.log(`- ${f}`));
                        console.log(chalk.gray('\nRun "foundryspec help <workflow-name>" to view a specific workflow.'));
                    } else {
                        console.log(chalk.yellow('No workflows found in templates.'));
                    }
                    return;
                }

                if (topic === 'agent') {
                    const guidePath = path.join(templateDir, 'FOUNDRYSPEC_AGENT_GUIDE.md');
                    if (await fs.pathExists(guidePath)) {
                        console.log(await fs.readFile(guidePath, 'utf8'));
                    } else {
                        console.log(chalk.yellow('FOUNDRYSPEC_AGENT_GUIDE.md not found in templates.'));
                        // Fallback log to help debug path issues
                        console.log(chalk.gray(`Checked path: ${guidePath}`));
                    }
                    return;
                }

                const workflowPath = path.join(templateDir, 'workflows', topic);
                let finalPath = '';
                if (await fs.pathExists(workflowPath)) {
                    finalPath = workflowPath;
                } else if (await fs.pathExists(workflowPath + '.md')) {
                    finalPath = workflowPath + '.md';
                }

                if (finalPath) {
                    console.log(await fs.readFile(finalPath, 'utf8'));
                } else {
                    console.log(chalk.red(`\n❌ Topic "${topic}" not found.`));
                    console.log(chalk.gray('Available topics: agent, workflows'));
                }

            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(chalk.red('\n❌ Failed to display help:'), msg);
            }
        });
}
