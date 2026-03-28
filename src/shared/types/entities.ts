import type { Platform, PostType, MediaType, TaskType, TaskStatus } from './index';

export interface PostEntity {
  id: string;
  platform: Platform;
  postId: string;
  postType: PostType;
  title: string;
  content: string;
  url: string;
  shortUrl?: string;
  coverUrl?: string;
  publishTime?: string;
  authorId?: string;
  authorName?: string;
  authorUrl?: string;
  likeCount?: number;
  commentCount?: number;
  collectCount?: number;
  shareCount?: number;
  viewCount?: number;
  mediaCount?: number;
  tags?: string[];
  sourcePageUrl: string;
  sourcePageType?: string;
  collectedAt: string;
  updatedAt: string;
  isFavorite?: boolean;
  note?: string;
  extra?: Record<string, unknown>;
}

export interface AuthorEntity {
  id: string;
  platform: Platform;
  authorId: string;
  name: string;
  avatar?: string;
  profileUrl: string;
  bio?: string;
  fansCount?: number;
  followCount?: number;
  likedCount?: number;
  workCount?: number;
  location?: string;
  gender?: string;
  verified?: boolean;
  verifiedDesc?: string;
  contactInfo?: string;
  sourcePageUrl: string;
  collectedAt: string;
  updatedAt: string;
  isFavorite?: boolean;
  note?: string;
  extra?: Record<string, unknown>;
}

export interface CommentEntity {
  id: string;
  platform: Platform;
  commentId: string;
  postId: string;
  postTitle?: string;
  authorId?: string;
  authorName?: string;
  authorAvatar?: string;
  content: string;
  likeCount?: number;
  replyCount?: number;
  publishTime?: string;
  sourcePageUrl: string;
  collectedAt: string;
  updatedAt: string;
  extra?: Record<string, unknown>;
}

export interface MediaEntity {
  id: string;
  platform: Platform;
  postId: string;
  mediaId?: string;
  mediaType: MediaType;
  url: string;
  coverUrl?: string;
  fileName?: string;
  ext?: string;
  width?: number;
  height?: number;
  duration?: number;
  downloadStatus?: 'pending' | 'success' | 'failed';
  sourcePageUrl: string;
  collectedAt: string;
  updatedAt: string;
  extra?: Record<string, unknown>;
}

export interface TaskEntity {
  id: string;
  taskType: TaskType;
  platform?: Platform;
  targetId?: string;
  targetUrl?: string;
  title?: string;
  status: TaskStatus;
  progress?: number;
  totalCount?: number;
  successCount?: number;
  failedCount?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
  meta?: Record<string, unknown>;
}
