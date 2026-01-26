/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU Affero General Public License v3.0 (AGPLv3).
 */

import { DiagramAnalyzer, DiagramAnalysis } from './BaseAnalyzer.js';

export class RequirementAnalyzer extends DiagramAnalyzer {
    analyze(content: string): DiagramAnalysis {
        const nodes: string[] = [];
        // Extract requirement names: requirement name { ... }
        // Also matches functionalRequirement, performanceRequirement, etc.
        const reqRegex = /^\s*(?:\w+Requirement|requirement)\s+([\w-]+)\s*\{/gm;
        
        let match;
        while ((match = reqRegex.exec(content)) !== null) {
            nodes.push(match[1]);
        }
        
        // Also look for explicit id: "..." inside the blocks for cross-referencing
        const idRegex = /^\s*id\s*:\s*["']([\w-]+)["']/gm;
        while ((match = idRegex.exec(content)) !== null) {
            if (!nodes.includes(match[1])) {
                nodes.push(match[1]);
            }
        }
        
        return { nodes, relationships: [], type: 'requirement' };
    }
}
