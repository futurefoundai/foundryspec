import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import yaml from 'js-yaml';
import { glob } from 'glob';
import { ConfigStore } from '../ConfigStore.js';
import { Rule, RuleSet } from '../types/rules.js';

export function registerGovernanceCommands(program: Command, store: ConfigStore) {
    program
        .command('add')
        .description('Interactive wizard to add a new governed component folder')
        .argument('<category>', 'Name of the category (e.g., "Payments", "Audit Logs")')
        .action(async (category: string) => {
            try {
                const root = process.cwd();
                const idPath = path.join(root, '.foundryid');
                if (!await fs.pathExists(idPath)) throw new Error('No .foundryid found. Run in project root.');
                const id = (await fs.readFile(idPath, 'utf8')).trim();

                console.log(chalk.blue(`\n🧙 FoundrySpec Governance Wizard`));
                console.log(chalk.gray(`Configuring new category: "${category}"`));

                // 1. Generate Proposal
                const slug = category.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                const title = category.charAt(0).toUpperCase() + category.slice(1);
                const prefixCandidate = slug.slice(0, 3).toUpperCase() + '_';
                
                // 2. Interactive Selection
                const answers = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'diagramType',
                        message: `What type of diagrams will "${title}" primarily contain?`,
                        choices: [
                            { name: 'Strict: Sequence Diagram (Interaction)', value: 'sequenceDiagram' },
                            { name: 'Strict: Mindmap (Taxonomy/Brainstorming)', value: 'mindmap' },
                            { name: 'Strict: Flowchart (Process/Logic)', value: 'flowchart' },
                            { name: 'Strict: Requirement Diagram (Traceability)', value: 'requirementDiagram' },
                            new inquirer.Separator(),
                            { name: 'Flexible: Any Mermaid Diagram (Metadata Only)', value: 'any' }
                        ]
                    }
                ]);

                const selectedType = answers.diagramType;
                const isStrict = selectedType !== 'any';

                // 3. Construct Rule
                const ruleId = `${slug}-registration`;
                const groupId = `GRP_${title.replace(/\s+/g, '')}`;
                
                const newRule: Rule = {
                    id: ruleId,
                    name: `${title} Registration`,
                    level: 'folder',
                    description: `Governance for ${title} domain.`,
                    target: {
                        idPrefix: prefixCandidate,
                        pathPattern: `${slug}/*`
                    },
                    type: isStrict ? 'syntax' : 'metadata',
                    enforcement: 'error',
                    // Explicitly empty checks/checks with type based on selection
                    checks: isStrict ? { 
                        mermaidType: selectedType,
                        requiredExtension: 'mermaid'
                    } : {},
                    hub: {
                        id: groupId,
                        title: title
                    }
                };

                // 4. Inject into Global Store Rules
                // We use the ID to find the correct storage path
                const customRulesPath = store.getRulesPath(id);
                let customRules: RuleSet = { rules: [] };
                
                // Ensure parent dir exists
                await fs.ensureDir(path.dirname(customRulesPath));

                if (await fs.pathExists(customRulesPath)) {
                    try {
                        const content = await fs.readFile(customRulesPath, 'utf8');
                        customRules = yaml.load(content) as RuleSet || { rules: [] };
                        if (!customRules.rules) customRules.rules = [];
                    } catch (_) { // eslint-disable-line @typescript-eslint/no-unused-vars
                        console.warn(chalk.yellow(`Warning: Could not parse existing custom rules. Overwriting.`));
                    }
                }

                // Check for duplicates
                if (customRules.rules.some(r => r.id === ruleId)) {
                    throw new Error(`Rule "${ruleId}" already exists in custom rules.`);
                }

                customRules.rules.push(newRule);
                await fs.writeFile(customRulesPath, yaml.dump(customRules));
                console.log(chalk.green(`\n✅ Governance Rule injected into Global Project Storage.`));

                // 5. Scaffold Directory & File
                const dirPath = path.join(root, 'docs', slug);
                await fs.ensureDir(dirPath);

                const starterId = `${prefixCandidate}Overview`;
                const starterFile = `${starterId}.mermaid`;
                
                let starterContent = `---
title: ${title} Overview
description: High-level overview of the ${title} domain.
id: "${starterId}"
uplink: "${groupId}"
---
`;
                
                if (selectedType === 'sequenceDiagram') {
                    starterContent += `sequenceDiagram
    participant User
    participant ${title}
    User->>${title}: Interact
`;
                } else if (selectedType === 'mindmap') {
                    starterContent += `mindmap
  root((${title}))
    Feature 1
    Feature 2
`;
                } else if (selectedType === 'requirementDiagram') {
                    starterContent += `requirementDiagram
    requirement Init {
        id: "${prefixCandidate}Init"
        text: "Initial requirement"
        risk: Low
        verifymethod: Test
    }
`;
                } else {
                    // Flowchart / Flexible default
                    starterContent += `graph TD
    A[Start] --> B[${title}]
`;
                }

                await fs.writeFile(path.join(dirPath, starterFile), starterContent);
                console.log(chalk.green(`✅ Scaffolding complete: docs/${slug}/${starterFile}`));
                console.log(chalk.gray(`\nRun 'foundryspec build' to update the hub.`));

            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(chalk.red('\n❌ Failed to add category:'), msg);
            }
        });

    program
        .command('remove')
        .description('Remove a governed component folder and its mapping rules')
        .argument('<category>', 'Name or slug of the category (e.g., "Payments")')
        .option('-f, --force', 'Bypass confirmation', false)
        .action(async (category: string, options: { force: boolean }) => {
            try {
                const root = process.cwd();
                const idPath = path.join(root, '.foundryid');
                if (!await fs.pathExists(idPath)) throw new Error('No .foundryid found.');
                const id = (await fs.readFile(idPath, 'utf8')).trim();

                const slug = category.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                const ruleId = `${slug}-registration`;
                const dirPath = path.join(root, 'docs', slug);

                // --- Safety Check: Dependency Analysis ---
                console.log(chalk.blue(`🔍 Checking dependencies for category "${category}"...`));
                
                // 1. Identify IDs "owned" by this category
                const ownedIds: Set<string> = new Set();
                if (await fs.pathExists(dirPath)) {
                    const targetFiles = await glob('**/*.{mermaid,md}', { cwd: dirPath });
                    for (const f of targetFiles) {
                        const content = await fs.readFile(path.join(dirPath, f), 'utf8');
                        const fm = content.match(/^---\s*\n([\s\S]*?)\n---/);
                        if (fm) {
                            try {
                                const data = yaml.load(fm[1]) as Record<string, unknown>;
                                const id = (data.id as string) || (data.traceability as Record<string, unknown>)?.id;
                                if (typeof id === 'string') ownedIds.add(id);
                            } catch {
                                // Skip invalid YAML
                            }
                        }
                    }
                }

                // 2. Scan project for incoming references
                const allFiles = await glob('docs/**/*.{mermaid,md}', { cwd: root });
                const incomingRefs: { file: string, targetId: string }[] = [];
                
                for (const f of allFiles) {
                    // Skip the folder we are trying to remove
                    if (f.startsWith(`docs/${slug}/`)) continue;

                    const content = await fs.readFile(path.join(root, f), 'utf8');
                    const fm = content.match(/^---\s*\n([\s\S]*?)\n---/);
                    if (fm) {
                        try {
                            const data = yaml.load(fm[1]) as Record<string, unknown>;
                            const check = (val: unknown) => {
                                if (!val) return;
                                const vals = Array.isArray(val) ? val : [val];
                                vals.forEach(v => {
                                    if (typeof v === 'string' && ownedIds.has(v)) {
                                        incomingRefs.push({ file: f, targetId: v });
                                    }
                                });
                            };

                            check(data.uplink || (data.traceability as Record<string, unknown>)?.uplink);
                            check(data.downlinks || (data.traceability as Record<string, unknown>)?.downlinks);
                            check(data.requirements);

                            if (Array.isArray(data.entities)) {
                                data.entities.forEach((ent: Record<string, unknown>) => {
                                    check(ent.uplink);
                                    check(ent.downlinks);
                                    check(ent.requirements);
                                });
                            }
                        } catch {
                            // Skip invalid YAML
                        }
                    }
                }

                if (incomingRefs.length > 0 && !options.force) {
                    console.error(chalk.red(`\n❌ Cannot remove category "${category}". It is required by other documents:`));
                    incomingRefs.forEach(ref => {
                        console.error(chalk.yellow(`   - ${ref.file} references node "${ref.targetId}"`));
                    });
                    console.error(chalk.cyan(`\nFix these dependencies or use --force to override (not recommended).`));
                    return;
                }

                if (!options.force) {
                    const confirm = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'ok',
                            message: incomingRefs.length > 0 
                                ? chalk.yellow(`⚠️  WARNING: This category is still referenced (see above). Force removal?`)
                                : `This will delete "docs/${slug}" and its governance rule. Continue?`,
                            default: false
                        }
                    ]);
                    if (!confirm.ok) return;
                }

                // 1. Remove Rule from Global Store
                const customRulesPath = store.getRulesPath(id);
                if (await fs.pathExists(customRulesPath)) {
                    const content = await fs.readFile(customRulesPath, 'utf8');
                    const customRules = yaml.load(content) as RuleSet || { rules: [] };
                    if (customRules.rules) {
                        const originalCount = customRules.rules.length;
                        customRules.rules = customRules.rules.filter(r => r.id !== ruleId);
                        if (customRules.rules.length < originalCount) {
                            await fs.writeFile(customRulesPath, yaml.dump(customRules));
                            console.log(chalk.green(`✅ Governance rule "${ruleId}" removed.`));
                        }
                    }
                }

                // 2. Delete Folder
                if (await fs.pathExists(dirPath)) {
                    await fs.remove(dirPath);
                    console.log(chalk.green(`✅ Directory "docs/${slug}" deleted.`));
                }

                console.log(chalk.cyan(`\nRun 'foundryspec build' to update the hub.`));

            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(chalk.red('\n❌ Failed to remove category:'), msg);
            }
        });
}
