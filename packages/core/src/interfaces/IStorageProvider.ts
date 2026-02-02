/**
 * Interface for abstract storage operations.
 * Allows switching between Local Filesystem (Core) and Cloud Storage (Enterprise).
 */
export interface IStorageProvider {
  read(path: string): Promise<string>;
  readJson<T>(path: string): Promise<T>;
  write(path: string, data: string): Promise<void>;
  writeJson(path: string, data: unknown): Promise<void>;
  exists(path: string): Promise<boolean>;
  delete(path: string): Promise<void>;
  ensureDir(path: string): Promise<void>;
  
  /**
   * Resolves a relative path to the provider's root.
   */
  resolvePath(relativePath: string): string;
}
