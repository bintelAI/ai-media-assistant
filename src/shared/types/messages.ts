import type { PostEntity, AuthorEntity, CommentEntity, MediaEntity, TaskEntity } from './entities';
import type { ExportRequest } from './export';
import type { Platform, PageType, TaskType } from './index';
import type { BatchCollectProgress, CollectResult } from './batchCollect';

export type MessageType =
  | 'collect:post'
  | 'collect:author'
  | 'collect:comments'
  | 'collect:postList'
  | 'export:data'
  | 'download:media'
  | 'task:create'
  | 'task:update'
  | 'task:status'
  | 'task:retry'
  | 'task:clear'
  | 'db:query'
  | 'db:insert'
  | 'db:update'
  | 'db:delete'
  | 'page:detected'
  | 'sidepanel:open'
  | 'cache:posts'
  | 'cache:author'
  | 'cache:comments'
  | 'batch:collect:start'
  | 'batch:collect:control'
  | 'batch:collect:progress'
  | 'batch:collect:status';

export interface Message<T = unknown> {
  type: MessageType;
  data?: T;
}

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CollectPostMessage {
  platform: Platform;
  post: Partial<PostEntity>;
}

export interface CollectAuthorMessage {
  platform: Platform;
  author: Partial<AuthorEntity>;
}

export interface CollectCommentsMessage {
  platform: Platform;
  postId: string;
  comments: Partial<CommentEntity>[];
}

export interface DownloadMediaMessage {
  url: string;
  fileName: string;
  postId?: string;
}

export interface PageDetectedMessage {
  platform: Platform;
  pageType: PageType;
  url: string;
}

export interface TaskCreateMessage {
  taskType: TaskType;
  platform?: Platform;
  targetId?: string;
  targetUrl?: string;
  title?: string;
  meta?: Record<string, unknown>;
}

export interface TaskUpdateMessage {
  taskId: string;
  status?: string;
  progress?: number;
  successCount?: number;
  failedCount?: number;
  errorMessage?: string;
}

export type CollectPostHandler = (
  message: CollectPostMessage
) => Promise<MessageResponse<PostEntity>>;

export type CollectAuthorHandler = (
  message: CollectAuthorMessage
) => Promise<MessageResponse<AuthorEntity>>;

export type ExportDataHandler = (
  request: ExportRequest
) => Promise<MessageResponse<void>>;

export type DownloadMediaHandler = (
  message: DownloadMediaMessage
) => Promise<MessageResponse<void>>;

/**
 * 批量采集开始消息
 */
export interface BatchCollectStartMessage {
  urls: string[];
}

/**
 * 批量采集控制消息
 */
export interface BatchCollectControlMessage {
  action: 'pause' | 'resume' | 'cancel';
}

/**
 * 批量采集进度消息
 */
export interface BatchCollectProgressMessage {
  progress: BatchCollectProgress;
}

/**
 * 批量采集状态响应
 */
export interface BatchCollectStatusResponse {
  isRunning: boolean;
  isPaused: boolean;
  progress: BatchCollectProgress;
}
