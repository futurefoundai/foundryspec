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
import { glob } from 'glob';
import matter from 'gray-matter';

interface ProbeResult {
    id: string;
    type: 'MISSING_IMPL' | 'ORPHAN_SPEC' | 'DRIFT';
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    file?: string;
}

// @foundryspec/start COMP_ProbeManager
export class ProbeManager {
    private specDir: string;
    private projectDir: string;

    constructor(specDir: string = process.cwd()) {
        this.specDir = path.resolve(specDir);
        this.projectDir = path.basename(this.specDir) === 'foundryspec' 
            ? path.dirname(this.specDir) 
            : this.specDir;
    }

    async runProbe(): Promise<void> {
        console.log(chalk.blue('📡 Initiating Automated Design Probe...'));
        
        const assetsDir = path.join(this.specDir, 'assets');
        if (!await fs.pathExists(assetsDir)) {
            throw new Error('Assets directory not found. Are you in a FoundrySpec project?');
        }

        const issues: ProbeResult[] = [];

        // 1. Load all Spec IDs
        const specIds = await this.loadSpecIds(assetsDir);
        console.log(chalk.gray(`Loaded ${specIds.size} architectural nodes from spec.`));

        // 2. Scan Codebase for Implementation Markers
        const codeMap = await this.scanCodebase();
        console.log(chalk.gray(`Found ${codeMap.size} implemented components in code.`));

        // 3. Compare Spec vs. Implementation
        // Check A: Spec exists but no code (Missing Implementation)
        // We filter for functional components/features only (COMP_*, FEAT_*)
        for (const id of specIds) {
            if ((id.startsWith('COMP_') || id.startsWith('FEAT_')) && !codeMap.has(id)) {
                issues.push({
                    id,
                    type: 'MISSING_IMPL',
                    severity: 'HIGH',
                    message: `Component "${id}" is defined in spec but has no implementation annotation in the codebase.`
                });
            }
        }

        // Check B: Code exists but no spec (Orphaned Code)
        for (const [id, files] of codeMap) {
            if (!specIds.has(id)) {
                issues.push({
                    id,
                    type: 'ORPHAN_SPEC',
                    severity: 'MEDIUM',
                    message: `Codebase contains annotation for "${id}" but it is not defined in any active spec file.`, 
                    file: files[0]
                });
            }
        }

        this.reportResults(issues);
    }

    private async loadSpecIds(assetsDir: string): Promise<Set<string>> {
        const ids = new Set<string>();
        const files = await glob('**/*.mermaid', { cwd: assetsDir, nodir: true });

        for (const file of files) {
            const content = await fs.readFile(path.join(assetsDir, file), 'utf8');
            const { data } = matter(content);

            if (data.id) ids.add(data.id);
            
            const entities = [
                ...(Array.isArray(data.entities) ? data.entities : []),
                ...(Array.isArray(data.traceability?.entities) ? data.traceability.entities : [])
            ];
            
            entities.forEach((e: any) => {
                if (e.id) ids.add(e.id);
            });
        }
        return ids;
    }

    private async scanCodebase(): Promise<Map<string, string[]>> {
        const idToFiles: Map<string, string[]> = new Map();
        const ignoreRules = ['node_modules/**', 'dist/**', '.git/**', 'foundryspec/dist/**'];

        const files = await glob('**/*.{ts,js,py,go,java,c,cpp,cs,rb,php,rs,swift}', {
            cwd: this.projectDir,
            nodir: true,
            ignore: ignoreRules
        });

        const markerRegex = new RegExp('@' + 'foundryspec(?:\\/start)?\\s+(?:REQUIREMENT\\s+)?([\\w\\-]+)', 'g');

        await Promise.all(files.map(async (file) => {
            const content = await fs.readFile(path.join(this.projectDir, file), 'utf8');
            let match;
            markerRegex.lastIndex = 0;
            while ((match = markerRegex.exec(content)) !== null) {
                const id = match[1];
                if (!idToFiles.has(id)) idToFiles.set(id, []);
                if (!idToFiles.get(id)!.includes(file)) {
                    idToFiles.get(id)!.push(file);
                }
            }
        }));

        return idToFiles;
    }

    private reportResults(issues: ProbeResult[]): void {
        if (issues.length === 0) {
            console.log(chalk.green('\n✅ System Healthy! No design/code drift detected.'));
            return;
        }

        console.log(chalk.yellow(`\n⚠️  Probe detected ${issues.length} architectural issues:\n`));

        for (const issue of issues) {
            const icon = issue.severity === 'HIGH' ? '🔴' : '⚠️';
            console.log(`${icon} [${issue.type}] ${chalk.bold(issue.id)}`);
            console.log(chalk.gray(`   ${issue.message}`));
            if (issue.file) console.log(chalk.gray(`   File: ${issue.file}`));
            console.log('');
        }

        if (issues.some(i => i.severity === 'HIGH')) {
            console.log(chalk.red('❌ Critical design gaps detected. Recommendation: Run "foundryspec design-feature" to implement missing specs.'));
            process.exit(1);
        }
    }
}
// @foundryspec/end
