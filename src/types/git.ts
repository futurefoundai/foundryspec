/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU Affero General Public License v3.0 (AGPLv3).
 */

export interface FileChange {
    file: string;
    commits: {
        hash: string;
        date: string;
        message: string;
        author: string;
    }[];
}
