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
    RequirementAnalyzer,
    ClassAnalyzer,
    C4Analyzer
} from './analyzers/index.js';

export interface ProjectContext {
    referencedIds: Set<string>;
    nodeMap: Map<string, { uplinks: string[], downlinks: string[] }>;
    idToFileMap: Map<string, string>;
}

// @foundryspec/start COMP_RuleEngine
export class RuleEngine {
    private rules: Rule[] = [];
    private hubCategories: HubCategory[] = [];
    private analyzers: Record<string, DiagramAnalyzer> = {
        'mindmap': new MindmapAnalyzer(),
        'sequenceDiagram': new SequenceAnalyzer(),
        'graph': new FlowchartAnalyzer(),
        'flowchart': new FlowchartAnalyzer(),
        'requirementDiagram': new RequirementAnalyzer(),
        'classDiagram': new ClassAnalyzer(),
        'C4Context': new C4Analyzer(),
        'C4Container': new C4Analyzer(),
        'C4Component': new C4Analyzer()
    };

    constructor() {}

    public getAnalyzers(): Record<string, DiagramAnalyzer> {
        return this.analyzers;
    }

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
        const { checks = {}, enforcement } = rule;
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
        // Universal Exemption: Footnotes are always Markdown, regardless of domain rules
        if (checks.requiredExtension) {
            const isFootnote = asset.relPath.includes('/footnotes/') || asset.relPath.startsWith('footnotes/');
            
            if (!isFootnote) {
                const ext = asset.relPath.split('.').pop();
                if (ext?.toLowerCase() !== checks.requiredExtension.replace(/^\./, '').toLowerCase()) {
                    errors.push(`File must have extension ".${checks.requiredExtension.replace(/^\./, '')}". Found ".${ext}"`);
                }
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
        
        // 5. Allowed Node Prefixes Check (Entity Verification)
        if (checks.allowedNodePrefixes && checks.mermaidType) {
            const analyzer = this.analyzers[checks.mermaidType];
            if (analyzer) {
                const analysis = analyzer.analyze(asset.content);
                for (const node of analysis.nodes) {
                    const hasValidPrefix = checks.allowedNodePrefixes.some(p => node.startsWith(p));
                    if (!hasValidPrefix) {
                        errors.push(`Invalid node ID: "${node}". Must start with one of: [${checks.allowedNodePrefixes.join(', ')}]`);
                    } else if (context && !context.idToFileMap.has(node)) {
                        errors.push(`Reference error: Node "${node}" exists in diagram but has no corresponding documentation file.`);
                    }
                }
            }
        }
        
        // 6. One-Per-File Check (with Single Parent Governance)
        if (checks.onePerFile && rule.target.idPrefix) {
            const definedEntities: string[] = [];
            
            // A. Check explicit sub-entities
            const entities = Array.isArray(asset.data.entities) ? asset.data.entities : [];
            entities.forEach((ent: Record<string, unknown>) => {
                if (typeof ent.id === 'string' && ent.id.startsWith(rule.target.idPrefix!)) {
                    definedEntities.push(ent.id);
                }
            });

            // B. Check File ID (Primary Entity)
            // If the file itself has an ID matching the prefix, it counts as the entity.
            if (asset.data.id && asset.data.id.startsWith(rule.target.idPrefix)) {
                if (!definedEntities.includes(asset.data.id)) {
                    definedEntities.push(asset.data.id);
                }
            }

            // Validation 1: Definitional Uniqueness
            if (definedEntities.length !== 1) {
                errors.push(
                    `Ambiguous Definition: Found ${definedEntities.length} entities with prefix "${rule.target.idPrefix}" in this file.\n` +
                    `   Matches: [${definedEntities.join(', ')}]\n` +
                    `   Rule: This file type must define EXACTLY ONE primary entity.`
                );
            } 
            
            // Validation 2: Single Parent (Strict Ownership)
            // "Only one node in an external file can link to this particular file"
            else if (context) {
                const entityId = definedEntities[0];
                const node = context.nodeMap.get(entityId);
                
                if (node) {
                    // In BuildManager, 'uplinks' stores the parents (nodes that this node points UP to).
                    // If strict hierarchy is followed, this node should point to exactly 1 parent.
                    // (Or if we look at it inversely: exactly 1 node should claim this as a child).
                    // Given the user constraint: "one node... can link to this", we check uplinks/parents.
                    
                    const parents = node.uplinks;
                    if (parents.length > 1) {
                        errors.push(
                            `Shared Ownership Violation: Entity "${entityId}" is linked to by ${parents.length} parents: [${parents.join(', ')}].\n` +
                            `   Rule: This entity must belong to exactly ONE parent node in a diagram (Single Responsibility).`
                        );
                    } else if (parents.length === 0) {
                        // Optional: Warn about orphans here? Or leave it to Traceability check?
                        // User "linking is not allowed" implies >1 is bad. 0 might be "Orphan" rule.
                        // We will strictly enforce "EXACTLY ONE" if we want to be safe, but typically 0 is handled by 'mustBeLinked'.
                        // Let's stick to preventing > 1 for "onePerFile" context.
                    }
                }
            }
        }
        
        // 7. Access Control Check
        if (checks.accessControl?.allowedReferencers && context) {
            const entities = Array.isArray(asset.data.entities) ? asset.data.entities : [];
            const nodeId = entities.find((ent: Record<string, unknown>) => 
                typeof ent.id === 'string' && ent.id.startsWith(rule.target.idPrefix || '')
            )?.id as string | undefined;
            
            if (nodeId && context.nodeMap.has(nodeId)) {
                const node = context.nodeMap.get(nodeId)!;
                const invalidReferencers = node.uplinks.filter((uplink: string) => {
                    const allowed = checks.accessControl!.allowedReferencers!;
                    return !allowed.some(prefix => uplink.startsWith(prefix));
                });
                
                if (invalidReferencers.length > 0) {
                    errors.push(
                        `Access control violation for "${nodeId}":\n` +
                        `  Invalid referencers: ${invalidReferencers.join(', ')}\n` +
                        `  Allowed prefixes: ${checks.accessControl!.allowedReferencers!.join(', ')}`
                    );
                }
            }
        }
        
        // 8. Traceability Check (Advanced)
        if (checks.traceability && context) {
            const { nodeMap, referencedIds } = context;
            const entities = [
                 // Check only explicit entities, treating File ID as metadata container by default
                ...(Array.isArray(asset.data.entities) ? asset.data.entities : [])
            ];

            for (const ent of entities) {
                if (!ent.id) continue;

                // A. Orphan Check
                if (checks.traceability.mustBeLinked && !referencedIds.has(ent.id)) {
                    errors.push(`Orphan detected: Node "${ent.id}" is not linked to by any other document.`);
                }

                // B. Recursive Uplink Check (mustTraceTo)
                if (checks.traceability.mustTraceTo && checks.traceability.mustTraceTo.length > 0) {
                    const traceTargets = checks.traceability.mustTraceTo;
                    const canReach = (currentId: string, visited: Set<string>): boolean => {
                        if (currentId === 'ROOT') return true; // Ultimate anchor is always valid
                        if (traceTargets.some(prefix => currentId.startsWith(prefix))) return true;
                        if (visited.has(currentId)) return false;
                        
                        visited.add(currentId);
                        const node = nodeMap.get(currentId);
                        if (!node) return false;

                        return node.uplinks.some(upid => canReach(upid, visited));
                    };

                    if (!canReach(ent.id, new Set())) {
                        errors.push(`Traceability Error: Node "${ent.id}" fails to trace back to any of: [${traceTargets.join(', ')}].`);
                    }
                }

                // C. Downlink Check (mustHaveDownlink)
                if (checks.traceability.mustHaveDownlink && checks.traceability.mustHaveDownlink.length > 0) {
                    const node = nodeMap.get(ent.id);
                    const implemented = node?.downlinks.some(d => 
                        checks.traceability!.mustHaveDownlink!.some(prefix => d.startsWith(prefix))
                    );
                    
                    // Also check if we are "implemented by" something (uplink FROM below)
                    // The graph might be bi-directional in the context map, typically uplinks from children = downlinks for parent.
                    // But context.nodeMap usually stores raw links. BuildManager assembles the full graph.
                    // Assuming nodeMap.downlinks contains ALL incoming connections from children? 
                    // Actually, BuildManager populates downlinks based on what it finds.
                    
                    if (!implemented) {
                         // Check reverse references (if something lists US as an uplink)
                         // This requires searching the whole map, or relying on BuildManager to have populated bi-directional links.
                         const hasImplementer = Array.from(nodeMap.entries()).some(([nid, n]) => 
                            n.uplinks.includes(ent.id) && checks.traceability!.mustHaveDownlink!.some(prefix => nid.startsWith(prefix))
                         );

                         if (!hasImplementer) {
                             errors.push(`Implementation Gap: Node "${ent.id}" has no downstream implementation in namespaces: [${checks.traceability.mustHaveDownlink.join(', ')}].`);
                         }
                    }
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
        // console.log(chalk.gray(`Derived ${computedCategories.length} Hub Categories from rules: ${computedCategories.map(c => c.id).join(', ')}`));
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
// @foundryspec/end
