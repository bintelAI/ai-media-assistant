import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { PostEntity, AuthorEntity, CommentEntity, MediaEntity, TaskEntity } from '../types/entities';
import type { ExportTemplate } from '../types/export';
import { DB_NAME, DB_VERSION, STORE_NAMES } from '../utils/constants';

interface ZhiLianCaiJiDB extends DBSchema {
  posts: {
    key: string;
    value: PostEntity;
    indexes: {
      'by-platform': string;
      'by-postId': string;
      'by-collectedAt': string;
      'by-platform-postId': [string, string];
    };
  };
  authors: {
    key: string;
    value: AuthorEntity;
    indexes: {
      'by-platform': string;
      'by-authorId': string;
      'by-collectedAt': string;
      'by-platform-authorId': [string, string];
    };
  };
  comments: {
    key: string;
    value: CommentEntity;
    indexes: {
      'by-platform': string;
      'by-postId': string;
      'by-collectedAt': string;
      'by-platform-commentId': [string, string];
    };
  };
  media: {
    key: string;
    value: MediaEntity;
    indexes: {
      'by-platform': string;
      'by-postId': string;
      'by-collectedAt': string;
    };
  };
  tasks: {
    key: string;
    value: TaskEntity;
    indexes: {
      'by-status': string;
      'by-taskType': string;
      'by-createdAt': string;
    };
  };
  templates: {
    key: string;
    value: ExportTemplate;
    indexes: {
      'by-targetType': string;
      'by-createdAt': string;
    };
  };
}

let dbInstance: IDBPDatabase<ZhiLianCaiJiDB> | null = null;

export async function initDB(): Promise<IDBPDatabase<ZhiLianCaiJiDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<ZhiLianCaiJiDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAMES.POSTS)) {
        const postsStore = db.createObjectStore(STORE_NAMES.POSTS, { keyPath: 'id' });
        postsStore.createIndex('by-platform', 'platform');
        postsStore.createIndex('by-postId', 'postId');
        postsStore.createIndex('by-collectedAt', 'collectedAt');
        postsStore.createIndex('by-platform-postId', ['platform', 'postId'], { unique: true });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.AUTHORS)) {
        const authorsStore = db.createObjectStore(STORE_NAMES.AUTHORS, { keyPath: 'id' });
        authorsStore.createIndex('by-platform', 'platform');
        authorsStore.createIndex('by-authorId', 'authorId');
        authorsStore.createIndex('by-collectedAt', 'collectedAt');
        authorsStore.createIndex('by-platform-authorId', ['platform', 'authorId'], { unique: true });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.COMMENTS)) {
        const commentsStore = db.createObjectStore(STORE_NAMES.COMMENTS, { keyPath: 'id' });
        commentsStore.createIndex('by-platform', 'platform');
        commentsStore.createIndex('by-postId', 'postId');
        commentsStore.createIndex('by-collectedAt', 'collectedAt');
        commentsStore.createIndex('by-platform-commentId', ['platform', 'commentId'], { unique: true });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.MEDIA)) {
        const mediaStore = db.createObjectStore(STORE_NAMES.MEDIA, { keyPath: 'id' });
        mediaStore.createIndex('by-platform', 'platform');
        mediaStore.createIndex('by-postId', 'postId');
        mediaStore.createIndex('by-collectedAt', 'collectedAt');
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.TASKS)) {
        const tasksStore = db.createObjectStore(STORE_NAMES.TASKS, { keyPath: 'id' });
        tasksStore.createIndex('by-status', 'status');
        tasksStore.createIndex('by-taskType', 'taskType');
        tasksStore.createIndex('by-createdAt', 'createdAt');
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.TEMPLATES)) {
        const templatesStore = db.createObjectStore(STORE_NAMES.TEMPLATES, { keyPath: 'id' });
        templatesStore.createIndex('by-targetType', 'targetType');
        templatesStore.createIndex('by-createdAt', 'createdAt');
      }
    }
  });

  return dbInstance;
}

export async function getDB(): Promise<IDBPDatabase<ZhiLianCaiJiDB>> {
  if (!dbInstance) {
    return initDB();
  }
  return dbInstance;
}

export * from './posts';
export * from './authors';
export * from './comments';
export * from './tasks';
export * from './templates';
