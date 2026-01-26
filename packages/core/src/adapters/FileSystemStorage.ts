import fs from 'fs-extra';
import path from 'path';
import { IStorageProvider } from '../interfaces/IStorageProvider.js';

export class FileSystemStorage implements IStorageProvider {
  private rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  resolvePath(relativePath: string): string {
    return path.join(this.rootDir, relativePath);
  }

  async read(relativePath: string): Promise<string> {
    return fs.readFile(this.resolvePath(relativePath), 'utf8');
  }

  async readJson<T>(relativePath: string): Promise<T> {
    return fs.readJson(this.resolvePath(relativePath));
  }

  async write(relativePath: string, data: string): Promise<void> {
    const fullPath = this.resolvePath(relativePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, data);
  }

  async writeJson(relativePath: string, data: any): Promise<void> {
    const fullPath = this.resolvePath(relativePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeJson(fullPath, data, { spaces: 2 });
  }

  async exists(relativePath: string): Promise<boolean> {
    return fs.pathExists(this.resolvePath(relativePath));
  }

  async delete(relativePath: string): Promise<void> {
    await fs.remove(this.resolvePath(relativePath));
  }

  async ensureDir(relativePath: string): Promise<void> {
    await fs.ensureDir(this.resolvePath(relativePath));
  }
}
