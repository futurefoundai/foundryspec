/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU Affero General Public License v3.0 (AGPLv3).
 */

import { DiagramAnalyzer, DiagramAnalysis } from './BaseAnalyzer.js';

export class StateDiagramAnalyzer extends DiagramAnalyzer {
    analyze(content: string): DiagramAnalysis {
        const nodes: string[] = [];
        const relationships: { from: string; to: string; label?: string }[] = [];
        
        // Match state declarations: state "Name" as STATE_ID or just STATE_ID
        const stateRegex = /^\s*(?:state\s+"([^"]+)"\s+as\s+(\w+)|state\s+(\w+))/gm;
        const transitionRegex = /^\s*(\w+)\s*-->\s*(\w+)\s*(?::\s*(.*))?/gm;

        let match;
        while ((match = stateRegex.exec(content)) !== null) {
            // match[2] is the ID when using 'state "Name" as ID'
            // match[3] is the ID when using just 'state ID'
            const stateId = match[2] || match[3];
            if (stateId) {
                nodes.push(stateId);
            }
        }
        
        while ((match = transitionRegex.exec(content)) !== null) {
            relationships.push({ from: match[1], to: match[2], label: match[3] });
        }
        
        return { nodes, relationships, type: 'state' };
    }
}
