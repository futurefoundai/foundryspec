/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU Affero General Public License v3.0 (AGPLv3).
 * For the full license text, see the LICENSE file in the root directory.
 *
 * COMMERCIAL USE:
 * Companies wishing to use this software in proprietary/closed-source environments
 * must obtain a separate license from FutureFoundAI.
 * See LICENSE-COMMERCIAL.md for details.
 */

import fs from "fs-extra";
import path from "path";
import os from "os";

// TODO: Move type definitions to a special file
export interface ExternalSpec {
  remote: string;
  target: string;
  branch: string;
}

export interface ProjectConfig {
  id: string;
  name: string;
  version: string;
  created: string;
  lastBuild?: string;
  external?: ExternalSpec[];
  categories: Array<{
    //TODO: Categories are dynamic so they should not be set in static mould, the system should automatically detect the folders that have things in them, is that not what is already done?
    name: string;
    path: string;
    description: string;
  }>;
}

// TODO: Move type definitions to a special file
export interface GlobalStore {
  projects: Record<string, ProjectConfig>;
}

// TODO: Move type definitions to a special file
export class ConfigStore {
  private globalDir: string;
  private dbPath: string;

  constructor() {
    this.globalDir = path.join(os.homedir(), ".foundryspec");
    this.dbPath = path.join(this.globalDir, "projects.json");
  }

  /**
   * Ensures the global directory and DB exist.
   */
  private async ensureStore(): Promise<GlobalStore> {
    await fs.ensureDir(this.globalDir);

    if (!(await fs.pathExists(this.dbPath))) {
      const initial: GlobalStore = { projects: {} };
      await fs.writeJson(this.dbPath, initial, { spaces: 2 });
      return initial;
    }

    return fs.readJson(this.dbPath);
  }

  /**
   * Saves a project configuration to the global store.
   */
  async saveProject(config: ProjectConfig): Promise<void> {
    const store = await this.ensureStore();
    store.projects[config.id] = config;
    await fs.writeJson(this.dbPath, store, { spaces: 2 });
  }

  /**
   * Retrieves a project configuration by ID.
   */
  async getProject(id: string): Promise<ProjectConfig | null> {
    const store = await this.ensureStore();
    return store.projects[id] || null;
  }

  /**
   * Returns the internal build directory for a project.
   * ~/.foundryspec/builds/<id>
   */
  getBuildDir(id: string): string {
    return path.join(this.globalDir, "builds", id);
  }

  /**
   * Returns the internal storage directory for a project (comments, etc).
   * ~/.foundryspec/storage/<id>
   */
  getStorageDir(id: string): string {
    return path.join(this.globalDir, "storage", id);
  }

  /**
   * Returns the path to the internal comments file.
   * ~/.foundryspec/storage/<id>/comments.json
   */
  getCommentsPath(id: string): string {
    return path.join(this.getStorageDir(id), "comments.json");
  }

  /**
   * Lists all registered projects.
   */
  async listProjects(): Promise<ProjectConfig[]> {
    const store = await this.ensureStore();
    return Object.values(store.projects);
  }

  /**
   * Updates a project's configuration with partial data.
   */
  async updateProject(
    id: string,
    updates: Partial<ProjectConfig>,
  ): Promise<void> {
    const store = await this.ensureStore();
    const project = store.projects[id];

    if (!project) {
      throw new Error(`Project with ID ${id} not found.`);
    }

    store.projects[id] = { ...project, ...updates };
    await fs.writeJson(this.dbPath, store, { spaces: 2 });
  }
}
