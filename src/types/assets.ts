/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU Affero General Public License v3.0 (AGPLv3).
 */

export interface ProjectAsset {
    relPath: string;
    absPath: string;
    content: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any; // Frontmatter data is loosely typed
}

export interface DiagramAnalysis {
    nodes: string[];
    relationships: { from: string; to: string; label?: string }[];
    type: string;
}
