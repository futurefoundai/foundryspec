/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU Affero General Public License v3.0 (AGPLv3).
 * For the full license text, see the LICENSE file in the root directory.
 */

import fs from 'fs-extra';
import yaml from 'js-yaml';
import chalk from 'chalk';
import { ProjectAsset } from './types/assets.js';
import { 
    RuleTarget, 
    Rule, 
    HubCategory, 
    RuleSet 
} from './types/rules.js';
import { 
    DiagramAnalyzer, 
    MindmapAnalyzer, 
    SequenceAnalyzer, 
    FlowchartAnalyzer, 
    RequirementAnalyzer 
} from './analyzers/index.js';

export interface ProjectContext {
    referencedIds: Set<string>;
}

export class RuleEngine {
    private rules: Rule[] = [];
    private hubCategories: HubCategory[] = [];
    private analyzers: Record<string, DiagramAnalyzer> = {
        'mindmap': new MindmapAnalyzer(),
        'sequenceDiagram': new SequenceAnalyzer(),
        'graph': new FlowchartAnalyzer(),
        'flowchart': new FlowchartAnalyzer(),
        'requirementDiagram': new RequirementAnalyzer()
    };

    constructor() {}

    async loadRules(rulesPath: string): Promise<void> {
        if (!await fs.pathExists(rulesPath)) return;
        
        try {
            const content = await fs.readFile(rulesPath, 'utf8');
            const data = yaml.load(content) as RuleSet;
            if (data && Array.isArray(data.rules)) {
                this.rules.push(...data.rules);
            }
            // Hub definitions are now embedded in rules, so we don't load data.hub separately.
        } catch (err) {
            console.error(chalk.red(`Failed to load rules from ${rulesPath}:`), err);
        }
    }

    validateAsset(asset: ProjectAsset, context?: ProjectContext): void {
        // Skip validation for synthetic assets (e.g., generated root.mermaid)
        if (!asset.absPath) return;

        const applicableRules = this.rules.filter(rule => this.matchesTarget(asset, rule.target));

        for (const rule of applicableRules) {
            this.executeRule(asset, rule, context);
        }
        
        // Governance Check: Verify ID matches folder prefix rule
        // Governance Check: Verify ID matches folder prefix rule
        this.validateGovernance(asset);

        // Filename Consistency Check: Verify ID matches Filename
        this.validateFilenameConsistency(asset);
    }

    /**
     * Determines if a rule applies to a specific asset based on its ID or file path.
     */
    private matchesTarget(asset: ProjectAsset, target: RuleTarget): boolean {
        // 1. Logical ID Match: Check if the asset's frontmatter ID starts with the required prefix (e.g., "REQ-")
        if (target.idPrefix && asset.data.id?.startsWith(target.idPrefix)) {
            return true;
        }

        // 2. Physical Path Match: Check if the file's location matches a glob-like pattern (e.g., "discovery/journeys/**")
        if (target.pathPattern) {
            // Simple glob-to-regex conversion:
            // ** matches any directory depth (.*)
            // * matches any character except '/' ([^/]*)
            // {a,b} matches brace expansion (a|b)
            const pattern = target.pathPattern
                .replace(/\./g, '\\.')
                .replace(/\*\*\//g, '(.*\\/)?')
                .replace(/\*\*/g, '.*')
                .replace(/\*/g, '[^/]*')
                .replace(/\{/g, '(')
                .replace(/\}/g, ')')
                .replace(/,/g, '|');
            const regex = new RegExp('^' + pattern + '$');
            if (regex.test(asset.relPath)) {
                return true;
            }
        }

        return false;
    }

    private executeRule(asset: ProjectAsset, rule: Rule, context?: ProjectContext): void {
        const { checks, enforcement } = rule;
        const errors: string[] = [];

        // 1. Syntax Check
        if (checks.mermaidType && asset.relPath.endsWith('.mermaid')) {
            if (!asset.content.trim().startsWith(checks.mermaidType)) {
                errors.push(`Must use Mermaid syntax type: "${checks.mermaidType}". Found: "${asset.content.trim().split('\n')[0]}"`);
            }
        }

        // 2. Metadata Check
        if (checks.requiredFrontmatter) {
            for (const field of checks.requiredFrontmatter) {
                if (!asset.data[field]) {
                    errors.push(`Missing required frontmatter: "${field}"`);
                }
            }
        }

        // 3. File Extension Check
        if (checks.requiredExtension) {
            const ext = asset.relPath.split('.').pop();
            if (ext?.toLowerCase() !== checks.requiredExtension.replace(/^\./, '').toLowerCase()) {
                errors.push(`File must have extension ".${checks.requiredExtension.replace(/^\./, '')}". Found ".${ext}"`);
            }
        }

        // 4. Structural Check
        if (checks.requiredNodes && checks.mermaidType) {
            const analyzer = this.analyzers[checks.mermaidType];
            if (analyzer) {
                const analysis = analyzer.analyze(asset.content);
                for (const requiredNode of checks.requiredNodes) {
                    if (!analysis.nodes.some(n => n.toLowerCase() === requiredNode.toLowerCase())) {
                        errors.push(`Missing required node: "${requiredNode}"`);
                    }
                }
            } else {
                // Fallback to basic line check if no specialized analyzer exists
                const lines = asset.content.split('\n').map(l => l.trim().toLowerCase());
                for (const node of checks.requiredNodes) {
                    if (!lines.some(l => l === node.toLowerCase() || l.startsWith(`${node.toLowerCase()}(`))) {
                        errors.push(`Missing required node (fallback check): "${node}"`);
                    }
                }
            }
        }

        // 5. Traceability Check (Orphan Detection)
        if (checks.traceability?.mustBeLinked && context) {
            const entities = Array.isArray(asset.data.entities) ? asset.data.entities : [];
            for (const ent of entities) {
                if (ent.id && !context.referencedIds.has(ent.id)) {
                    errors.push(`Orphan detected: Entity (ID: "${ent.id}") within "${asset.relPath}" is not linked to by any other document.`);
                }
            }
        }

        if (errors.length > 0) {
            const color = enforcement === 'error' ? chalk.red : chalk.yellow;
            const prefix = enforcement === 'error' ? '❌' : '⚠️';
            const description = rule.description ? ` (${rule.description})` : '';
            
            console.error(color(`\n${prefix} Rule violation: ${rule.name}${description}\n   Rule ID: ${rule.id} | Level: ${rule.level || 'file'} | File: ${asset.relPath}`));
            errors.forEach(err => console.error(color(`   - ${err}`)));
            
            if (enforcement === 'error') {
                throw new Error(`Build failed due to rule violations.`);
            }
        }
    }

    getHubCategories(): HubCategory[] {
        // Derive categories dynamically from rules
        const computedCategories: HubCategory[] = [];
        
        for (const rule of this.rules) {
            if (rule.hub && rule.target.pathPattern) {
                // Extract clean path from pattern (e.g., "personas/*" -> "personas")
                const cleanPath = rule.target.pathPattern.replace(/\/\*+$/, '').replace(/\*$/, '');
                
                computedCategories.push({
                    id: rule.hub.id,
                    title: rule.hub.title,
                    path: cleanPath,
                    // Infer idPrefix from the rule target itself
                    idPrefix: rule.target.idPrefix
                });
            }
        }
        console.log(chalk.gray(`Derived ${computedCategories.length} Hub Categories from rules: ${computedCategories.map(c => c.id).join(', ')}`));
        return computedCategories;
    }

    private validateGovernance(asset: ProjectAsset): void {
        const categories = this.getHubCategories();
        
        // Find which category this asset belongs to based on path
        // We match explicitly against the category path
        const category = categories.find(cat => {
            return asset.relPath === cat.path || asset.relPath.startsWith(cat.path + '/');
        });

        if (category && category.idPrefix) {
            const assetId = asset.data.id;
            // Skip check if no ID (handled by other rules)
            if (assetId && !assetId.startsWith(category.idPrefix)) {
                console.error(chalk.red(`\n❌ Governance Violation: ID Prefix Mismatch
   File: ${asset.relPath}
   Category: ${category.title} (${category.path})
   Rule: IDs must start with "${category.idPrefix}"
   Found: "${assetId}"`));
                throw new Error(`Build failed due to Governance Violation.`);
            }
        }
    }

    // Additional validation methods for traceability, etc. can be added here
    private validateFilenameConsistency(asset: ProjectAsset): void {
        // Skip for non-spec files or files without IDs
        if (!asset.data.id || !asset.relPath) return;

        // Extract filename without extension
        // e.g. "docs/requirements/REQ_Core.mermaid" -> "REQ_Core"
        const parts = asset.relPath.split('/');
        const filename = parts[parts.length - 1];
        const basename = filename.split('.').slice(0, -1).join('.');

        // Special case: Ignore system files if needed, or enforce strictly everywhere
        // User requested: "file name and file ID for rule must be the same"
        // Exceptions? Maybe RULES_GUIDE?
        if (asset.relPath === 'RULES_GUIDE.md') return;

        // Also ignore if it's not a mermaid or md file
        if (!asset.relPath.endsWith('.mermaid') && !asset.relPath.endsWith('.md')) return;

        if (asset.data.id !== basename) {
                console.error(chalk.red(`\n❌ Governance Violation: Filename-ID Mismatch
   File: ${asset.relPath}
   ID:   "${asset.data.id}"
   Name: "${basename}"
   Rule: The File Name and File ID must be identical.`));
                throw new Error(`Build failed due to Governance Violation.`);
        }
    }
}
