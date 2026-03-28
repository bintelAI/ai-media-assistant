import type { AuthorEntity } from '../types/entities';
import { getDB } from './index';
import { generateId } from '../utils/helpers';

export interface AuthorQueryOptions {
  platform?: string;
  keyword?: string;
  minFans?: number;
  maxFans?: number;
  limit?: number;
  offset?: number;
  orderBy?: 'collectedAt' | 'fansCount' | 'workCount';
  orderDirection?: 'asc' | 'desc';
}

export async function addAuthor(author: Omit<AuthorEntity, 'id' | 'collectedAt' | 'updatedAt'>): Promise<string> {
  const db = await getDB();
  
  const existing = await findAuthorByPlatformAndId(author.platform, author.authorId);
  
  const now = new Date().toISOString();
  
  if (existing) {
    const updated: AuthorEntity = {
      ...existing,
      ...author,
      updatedAt: now
    };
    await db.put('authors', updated);
    return existing.id;
  }
  
  const entity: AuthorEntity = {
    ...author,
    id: generateId('author'),
    collectedAt: now,
    updatedAt: now
  };
  
  await db.add('authors', entity);
  return entity.id;
}

export async function updateAuthor(id: string, updates: Partial<AuthorEntity>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('authors', id);
  
  if (!existing) {
    throw new Error(`Author not found: ${id}`);
  }
  
  const updated: AuthorEntity = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  await db.put('authors', updated);
}

export async function deleteAuthor(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('authors', id);
}

export async function deleteAuthors(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('authors', 'readwrite');
  
  await Promise.all(ids.map(id => tx.store.delete(id)));
  
  await tx.done;
}

export async function getAuthor(id: string): Promise<AuthorEntity | undefined> {
  const db = await getDB();
  return db.get('authors', id);
}

export async function findAuthorByPlatformAndId(platform: string, authorId: string): Promise<AuthorEntity | undefined> {
  const db = await getDB();
  return db.getFromIndex('authors', 'by-platform-authorId', [platform, authorId]);
}

export async function queryAuthors(options: AuthorQueryOptions = {}): Promise<AuthorEntity[]> {
  const db = await getDB();
  let authors: AuthorEntity[];
  
  if (options.platform) {
    authors = await db.getAllFromIndex('authors', 'by-platform', options.platform);
  } else {
    authors = await db.getAll('authors');
  }
  
  if (options.keyword) {
    const keyword = options.keyword.toLowerCase();
    authors = authors.filter(
      a =>
        a.name?.toLowerCase().includes(keyword) ||
        a.bio?.toLowerCase().includes(keyword)
    );
  }
  
  if (options.minFans !== undefined) {
    authors = authors.filter(a => (a.fansCount ?? 0) >= options.minFans!);
  }
  
  if (options.maxFans !== undefined) {
    authors = authors.filter(a => (a.fansCount ?? 0) <= options.maxFans!);
  }
  
  const orderBy = options.orderBy || 'collectedAt';
  const orderDirection = options.orderDirection || 'desc';
  
  authors.sort((a, b) => {
    const aValue = a[orderBy];
    const bValue = b[orderBy];
    
    if (aValue === undefined || aValue === null) return 1;
    if (bValue === undefined || bValue === null) return -1;
    
    const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    return orderDirection === 'desc' ? -comparison : comparison;
  });
  
  if (options.offset !== undefined) {
    authors = authors.slice(options.offset);
  }
  
  if (options.limit !== undefined) {
    authors = authors.slice(0, options.limit);
  }
  
  return authors;
}

export async function countAuthors(options: Omit<AuthorQueryOptions, 'limit' | 'offset' | 'orderBy' | 'orderDirection'> = {}): Promise<number> {
  const authors = await queryAuthors(options);
  return authors.length;
}

export async function clearAuthors(): Promise<void> {
  const db = await getDB();
  await db.clear('authors');
}
