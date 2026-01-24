/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU Affero General Public License v3.0 (AGPLv3).
 */

import { DiagramAnalyzer, DiagramAnalysis } from './BaseAnalyzer.js';

export class C4Analyzer extends DiagramAnalyzer {
    analyze(content: string): DiagramAnalysis {
        const nodes: string[] = [];
        const relationships: { from: string; to: string; label?: string }[] = [];

        // Node regex for C4: Person, System, Container, Component, etc.
        // Format: System(id, "Title", "Desc") or ContainerDb(id, ...)
        const nodeRegex = /^\s*(?:Person|System|System_Ext|Container|ContainerDb|Component|Boundary|System_Boundary|Container_Boundary|Enterprise_Boundary)\(([\w-]+)/gm;
        
        // Relationship regex for C4: Rel, BiRel, Rel_D, etc.
        // Format: Rel(from, to, "Label")
        const relRegex = /^\s*(?:Rel|BiRel|Rel_D|Rel_U|Rel_L|Rel_R)\(([\w-]+),\s*([\w-]+)(?:,\s*"(.*)")?/gm;

        let match;
        // 1. Find Nodes
        while ((match = nodeRegex.exec(content)) !== null) {
            if (match[1]) {
                nodes.push(match[1]);
            }
        }

        // 2. Find Relationships
        while ((match = relRegex.exec(content)) !== null) {
            relationships.push({ 
                from: match[1], 
                to: match[2], 
                label: match[3] 
            });
            
            // Collect nodes mentioned in relations but not defined
            if (!nodes.includes(match[1])) nodes.push(match[1]);
            if (!nodes.includes(match[2])) nodes.push(match[2]);
        }

        return { 
            nodes: Array.from(new Set(nodes)), 
            relationships, 
            type: 'C4' 
        };
    }
}
