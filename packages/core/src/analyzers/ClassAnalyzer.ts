/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU Affero General Public License v3.0 (AGPLv3).
 */

import { DiagramAnalyzer, DiagramAnalysis } from './BaseAnalyzer.js';

export class ClassAnalyzer extends DiagramAnalyzer {
    analyze(content: string): DiagramAnalysis {
        const nodes: string[] = [];
        const relationships: { from: string; to: string; label?: string }[] = [];

        // Class definition regex: class Name { ... } or class Name
        const classDefRegex = /^\s*class\s+([\w-]+)(?:\s*\{)?/gm;
        // Simple relationship regex: A --> B, A -- B, A .. B, A --|> B, etc.
        const relRegex = /^\s*([\w-]+)\s*(?:--|>|..|->|<-|--|>|--\*|--o|--\^|--|>|--|>|--|>)\s*([\w-]+)(?:\s*:\s*(.*))?/gm;

        let match;
        // 1. Find Classes
        while ((match = classDefRegex.exec(content)) !== null) {
            if (match[1] && !['classDiagram'].includes(match[1])) {
                nodes.push(match[1]);
            }
        }

        // 2. Find Relationships
        while ((match = relRegex.exec(content)) !== null) {
            // Check if it's a valid relationship part and not keywords
            if (match[1] !== 'class' && match[2] !== 'class') {
                relationships.push({ 
                    from: match[1], 
                    to: match[2], 
                    label: match[3]?.trim() 
                });
                
                // Also add nodes if they weren't explicitly defined with 'class' keyword
                if (!nodes.includes(match[1])) nodes.push(match[1]);
                if (!nodes.includes(match[2])) nodes.push(match[2]);
            }
        }

        return { 
            nodes: Array.from(new Set(nodes)), 
            relationships, 
            type: 'classDiagram' 
        };
    }
}
