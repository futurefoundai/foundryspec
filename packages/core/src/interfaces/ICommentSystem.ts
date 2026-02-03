export interface Comment {
  id: string;
  file: string; // Relative path or ID
  line?: number;
  author: string;
  content: string;
  status: 'open' | 'resolved';
  context?: { viewTitle?: string; [key: string]: any };
  createdAt: string;
  updatedAt: string;
}

export interface ICommentSystem {
  addComment(comment: Omit<Comment, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<Comment>;
  listComments(file?: string): Promise<Comment[]>;
  resolveComment(id: string, author: string): Promise<void>;
  deleteComment(id: string): Promise<void>;
}
