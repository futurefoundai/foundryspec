/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU Affero General Public License v3.0 (AGPLv3).
 */

import { ProjectAsset } from './assets.js';

/**
 * Context provided to rule validation logic.
 * Contains global project state and references.
 */
export interface ProjectContext {
    /** Set of all IDs referenced in the project (uplinks/downlinks) */
    referencedIds: Set<string>;
    /** Map of all nodes to their relationship data */
    nodeMap: Map<string, { uplinks: string[], downlinks: string[] }>;
    /** Map of node IDs to the file path where they are defined */
    idToFileMap: Map<string, string>;
}

export interface RuleTarget {
    /** 
     * If set, rule applies to assets with IDs starting with this prefix.
     * e.g. "PER_" for Personas.
     */
    idPrefix?: string;
    /** 
     * Glob pattern matching file paths this rule applies to.
     * e.g. "personas/**"
     */
    pathPattern?: string;
}

export interface RuleChecks {
    mermaidType?: string;
    requiredNodes?: string[];
    requiredFrontmatter?: string[];
    requiredExtension?: string;
    onePerFile?: boolean; // Enforce exactly one entity per file
    traceability?: {
        linksToPersona?: boolean;
        requiresImplementation?: boolean;
        mustBeLinked?: boolean;
        mustTraceTo?: string[];
        mustHaveDownlink?: string[];
        allowedDownlinkPrefixes?: string[];
    };
    accessControl?: {
        allowedReferencers?: string[]; // ID prefixes allowed to link to this category
    };
    allowedNodePrefixes?: string[];
}

export interface Rule {
    /** Unique identifier for the rule (e.g., 'persona-gate') */
    id: string;
    /** Human-readable name of the rule */
    name: string;
    /** Detailed description of what the rule enforces */
    description?: string;
    /** 
     * The scope/level this rule applies to.
     * - project: Applies to the entire codebase globally.
     * - folder: Applies to specific directory categories (e.g., 'personas/').
     * - file: Applies to individual files.
     * - node: Applies to specific nodes/entities within files.
     */
    level?: 'project' | 'folder' | 'file' | 'node';
    /** Targeting criteria to select assets this rule applies to */
    target: RuleTarget;
    /** 
     * The category of rule for reporting.
     * - structural: Checks graph structure or file organization.
     * - syntax: Checks content syntax (e.g. Mermaid correctness).
     * - metadata: Checks frontmatter or tags.
     * - traceability: Checks links between artifacts.
     */
    type: 'structural' | 'syntax' | 'metadata' | 'traceability';
    /** Whether violations are fatal errors or just warnings */
    enforcement: 'error' | 'warning';
    /** 
     * Deprecated: Declarative checks (being replaced by `validate` function).
     * Kept for backward compatibility during migration.
     */
    checks?: RuleChecks;
    /** 
     * Custom validation logic for this rule.
     * @param asset The asset being validated.
     * @param context Global project context for cross-reference checks.
     * @returns Array of error messages, or void if successful. 
     */
    validate?: (asset: ProjectAsset, context: ProjectContext) => string[] | void | Promise<string[] | void>;
    
    // Hub Definition: If this rule targets a folder, it can define the Hub Category.
    hub?: {
        id: string;
        title: string;
    };
}

export interface HubCategory {
    id: string;
    title: string;
    path: string;
    idPrefix?: string;
}

export interface RuleSet {
    rules: Rule[];
}
