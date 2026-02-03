import { ICommentSystem, Comment } from '../interfaces/ICommentSystem.js';
import { IStorageProvider } from '../interfaces/IStorageProvider.js';
import { randomUUID } from 'crypto';

// Matches existing format: { "compositeKey": [ { ...comment } ] }
type CommentsRegistry = Record<string, Comment[]>;

export class LocalCommentSystem implements ICommentSystem {
  private storage: IStorageProvider;
  private dbPath: string;

  constructor(storage: IStorageProvider, dbPath: string = 'comments.json') {
    this.storage = storage;
    this.dbPath = dbPath;
  }

  private async getDB(): Promise<CommentsRegistry> {
    if (await this.storage.exists(this.dbPath)) {
      return this.storage.readJson<CommentsRegistry>(this.dbPath);
    }
    return {};
  }

  private async saveDB(db: CommentsRegistry): Promise<void> {
    await this.storage.writeJson(this.dbPath, db);
  }

  // Note: The params usually come from the frontend which includes compositeKey
  async addComment(params: Omit<Comment, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { compositeKey?: string, context?: any }): Promise<Comment> {
    const db = await this.getDB();
    const id = randomUUID();
    const now = new Date().toISOString();
    
    // Fallback if compositeKey is missing from params (should be there for grouping)
    // The frontend sends it in the payload usually.
    // We strictly need it to group comments.
    // If not provided, maybe use 'global'?
    // But the interface definition I wrote earlier didn't have compositeKey.
    // I should cast or assume params has it if passed as any, or update interface.
    // Let's assume params might have it or we use file as key.
    
    // For now, let's treat 'file' as the key if compositeKey is missing, 
    // but typically compositeKey = "pagId#nodeId".
    const key = params.compositeKey || params.file || 'global';

    const newComment: Comment = {
      id,
      ...params,
      context: params.context,
      status: 'open',
      createdAt: now,
      updatedAt: now
    };

    // Remove compositeKey from the stored object if we want to be clean, 
    // but keeping it is harmless.
    
    if (!db[key]) db[key] = [];
    db[key].push(newComment);
    
    await this.saveDB(db);
    return newComment;
  }

  async listComments(file?: string): Promise<Comment[]> {
    const db = await this.getDB();
    const allLists = Object.values(db);
    const all = allLists.flat();
    if (file) {
      return all.filter(c => c.file === file);
    }
    return all;
  }

  async resolveComment(id: string, _author: string): Promise<void> {
    const db = await this.getDB();
    for (const key in db) {
      const idx = db[key].findIndex(c => c.id === id);
      if (idx !== -1) {
        db[key][idx].status = 'resolved';
        db[key][idx].updatedAt = new Date().toISOString();
        await this.saveDB(db);
        return;
      }
    }
  }

  async deleteComment(id: string): Promise<void> {
    const db = await this.getDB();
    for (const key in db) {
      const initialLen = db[key].length;
      db[key] = db[key].filter(c => c.id !== id);
      if (db[key].length !== initialLen) {
        if (db[key].length === 0) delete db[key];
        await this.saveDB(db);
        return;
      }
    }
  }
}
