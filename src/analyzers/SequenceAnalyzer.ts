/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU Affero General Public License v3.0 (AGPLv3).
 */

import { DiagramAnalyzer, DiagramAnalysis } from './BaseAnalyzer.js';

export class SequenceAnalyzer extends DiagramAnalyzer {
    analyze(content: string): DiagramAnalysis {
        const nodes: string[] = [];
        const relationships: { from: string; to: string; label?: string }[] = [];
        
        // Updated regex to handle both:
        // - participant User as PER_User  (captures PER_User)
        // - participant PER_User          (captures PER_User)
        const actorRegex = /^\s*(?:actor|participant)\s+(\w+)(?:\s+as\s+(\w+))?/gm;
        const arrowRegex = /^\s*([\w-]+)\s*->>?\s*([\w-]+)\s*:\s*(.*)/gm;

        let match;
        while ((match = actorRegex.exec(content)) !== null) {
            // Always use match[1] which is the participant ID
            // Format: "participant COMP_Auth as Auth Service"
            // match[1] = COMP_Auth (what we want)
            // match[2] = Auth (just first word of alias - don't use this)
            nodes.push(match[1]);
        }
        while ((match = arrowRegex.exec(content)) !== null) {
            relationships.push({ from: match[1], to: match[2], label: match[3] });
        }
        return { nodes, relationships, type: 'sequence' };
    }
}
