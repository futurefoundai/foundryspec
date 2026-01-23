/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU Affero General Public License v3.0 (AGPLv3).
 */

export interface RuleTarget {
    idPrefix?: string;
    pathPattern?: string;
}

export interface RuleChecks {
    mermaidType?: string;
    requiredNodes?: string[];
    requiredFrontmatter?: string[];
    requiredExtension?: string;
    traceability?: {
        linksToPersona?: boolean;
        requiresImplementation?: boolean;
        mustBeLinked?: boolean;
        allowedDownlinkPrefixes?: string[];
    };
}

export interface Rule {
    id: string;
    name: string;
    description?: string;
    level?: 'project' | 'folder' | 'file' | 'node';
    target: RuleTarget;
    type: 'structural' | 'syntax' | 'metadata' | 'traceability';
    enforcement: 'error' | 'warning';
    checks: RuleChecks;
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
