import type { PostEntity } from '../types/entities';
import { getDB } from './index';
import { generateId } from '../utils/helpers';

export interface PostQueryOptions {
  platform?: string;
  authorId?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'collectedAt' | 'publishTime' | 'likeCount';
  orderDirection?: 'asc' | 'desc';
}

export async function addPost(post: Omit<PostEntity, 'id' | 'collectedAt' | 'updatedAt'>): Promise<string> {
  const db = await getDB();
  
  const existing = await findPostByPlatformAndId(post.platform, post.postId);
  
  const now = new Date().toISOString();
  
  if (existing) {
    const updated: PostEntity = {
      ...existing,
      ...post,
      updatedAt: now
    };
    await db.put('posts', updated);
    return existing.id;
  }
  
  const entity: PostEntity = {
    ...post,
    id: generateId('post'),
    collectedAt: now,
    updatedAt: now
  };
  
  await db.add('posts', entity);
  return entity.id;
}

export async function updatePost(id: string, updates: Partial<PostEntity>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('posts', id);
  
  if (!existing) {
    throw new Error(`Post not found: ${id}`);
  }
  
  const updated: PostEntity = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  await db.put('posts', updated);
}

export async function deletePost(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('posts', id);
}

export async function deletePosts(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('posts', 'readwrite');
  
  await Promise.all(ids.map(id => tx.store.delete(id)));
  
  await tx.done;
}

export async function getPost(id: string): Promise<PostEntity | undefined> {
  const db = await getDB();
  return db.get('posts', id);
}

export async function findPostByPlatformAndId(platform: string, postId: string): Promise<PostEntity | undefined> {
  const db = await getDB();
  return db.getFromIndex('posts', 'by-platform-postId', [platform, postId]);
}

export async function queryPosts(options: PostQueryOptions = {}): Promise<PostEntity[]> {
  const db = await getDB();
  let posts: PostEntity[];
  
  if (options.platform) {
    posts = await db.getAllFromIndex('posts', 'by-platform', options.platform);
  } else {
    posts = await db.getAll('posts');
  }
  
  if (options.keyword) {
    const keyword = options.keyword.toLowerCase();
    posts = posts.filter(
      p =>
        p.title?.toLowerCase().includes(keyword) ||
        p.content?.toLowerCase().includes(keyword) ||
        p.authorName?.toLowerCase().includes(keyword)
    );
  }
  
  if (options.authorId) {
    posts = posts.filter(p => p.authorId === options.authorId);
  }
  
  if (options.startDate) {
    posts = posts.filter(p => p.collectedAt >= options.startDate!);
  }
  
  if (options.endDate) {
    posts = posts.filter(p => p.collectedAt <= options.endDate!);
  }
  
  const orderBy = options.orderBy || 'collectedAt';
  const orderDirection = options.orderDirection || 'desc';
  
  posts.sort((a, b) => {
    const aValue = a[orderBy];
    const bValue = b[orderBy];
    
    if (aValue === undefined || aValue === null) return 1;
    if (bValue === undefined || bValue === null) return -1;
    
    const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    return orderDirection === 'desc' ? -comparison : comparison;
  });
  
  if (options.offset !== undefined) {
    posts = posts.slice(options.offset);
  }
  
  if (options.limit !== undefined) {
    posts = posts.slice(0, options.limit);
  }
  
  return posts;
}

export async function countPosts(options: Omit<PostQueryOptions, 'limit' | 'offset' | 'orderBy' | 'orderDirection'> = {}): Promise<number> {
  const posts = await queryPosts(options);
  return posts.length;
}

export async function clearPosts(): Promise<void> {
  const db = await getDB();
  await db.clear('posts');
}
