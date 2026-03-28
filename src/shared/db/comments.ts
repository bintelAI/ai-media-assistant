import type { CommentEntity } from '../types/entities';
import { getDB } from './index';
import { generateId } from '../utils/helpers';

export interface CommentQueryOptions {
  platform?: string;
  postId?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'collectedAt' | 'likeCount' | 'publishTime';
  orderDirection?: 'asc' | 'desc';
}

export async function addComment(comment: Omit<CommentEntity, 'id' | 'collectedAt' | 'updatedAt'>): Promise<string> {
  const db = await getDB();
  
  const existing = await findCommentByPlatformAndId(comment.platform, comment.commentId);
  
  const now = new Date().toISOString();
  
  if (existing) {
    const updated: CommentEntity = {
      ...existing,
      ...comment,
      updatedAt: now
    };
    await db.put('comments', updated);
    return existing.id;
  }
  
  const entity: CommentEntity = {
    ...comment,
    id: generateId('comment'),
    collectedAt: now,
    updatedAt: now
  };
  
  await db.add('comments', entity);
  return entity.id;
}

export async function addComments(comments: Omit<CommentEntity, 'id' | 'collectedAt' | 'updatedAt'>[]): Promise<string[]> {
  const ids: string[] = [];
  for (const comment of comments) {
    const id = await addComment(comment);
    ids.push(id);
  }
  return ids;
}

export async function deleteComment(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('comments', id);
}

export async function deleteComments(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('comments', 'readwrite');
  
  await Promise.all(ids.map(id => tx.store.delete(id)));
  
  await tx.done;
}

export async function getComment(id: string): Promise<CommentEntity | undefined> {
  const db = await getDB();
  return db.get('comments', id);
}

export async function findCommentByPlatformAndId(platform: string, commentId: string): Promise<CommentEntity | undefined> {
  const db = await getDB();
  return db.getFromIndex('comments', 'by-platform-commentId', [platform, commentId]);
}

export async function queryComments(options: CommentQueryOptions = {}): Promise<CommentEntity[]> {
  const db = await getDB();
  let comments: CommentEntity[];
  
  if (options.platform) {
    comments = await db.getAllFromIndex('comments', 'by-platform', options.platform);
  } else {
    comments = await db.getAll('comments');
  }
  
  if (options.postId) {
    comments = comments.filter(c => c.postId === options.postId);
  }
  
  if (options.keyword) {
    const keyword = options.keyword.toLowerCase();
    comments = comments.filter(
      c =>
        c.content?.toLowerCase().includes(keyword) ||
        c.authorName?.toLowerCase().includes(keyword)
    );
  }
  
  const orderBy = options.orderBy || 'collectedAt';
  const orderDirection = options.orderDirection || 'desc';
  
  comments.sort((a, b) => {
    const aValue = a[orderBy];
    const bValue = b[orderBy];
    
    if (aValue === undefined || aValue === null) return 1;
    if (bValue === undefined || bValue === null) return -1;
    
    const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    return orderDirection === 'desc' ? -comparison : comparison;
  });
  
  if (options.offset !== undefined) {
    comments = comments.slice(options.offset);
  }
  
  if (options.limit !== undefined) {
    comments = comments.slice(0, options.limit);
  }
  
  return comments;
}

export async function countComments(options: Omit<CommentQueryOptions, 'limit' | 'offset' | 'orderBy' | 'orderDirection'> = {}): Promise<number> {
  const comments = await queryComments(options);
  return comments.length;
}

export async function clearComments(): Promise<void> {
  const db = await getDB();
  await db.clear('comments');
}
