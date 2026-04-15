import type { Platform, PageType } from './index';
import type { PostEntity, AuthorEntity } from './entities';

/**
 * 解析后的URL信息
 */
export interface ParsedUrl {
  platform: Platform;
  pageType: PageType;
  id: string;
  originalUrl: string;
  xsecSource?: string;
  xsecToken?: string;
  isShortUrl?: boolean;
}

/**
 * 单个采集任务
 */
export interface CollectTask {
  url: string;
  parsed: ParsedUrl;
  status: 'pending' | 'running' | 'success' | 'failed';
  retryCount: number;
  error?: string;
  data?: PostEntity | AuthorEntity;
}

/**
 * 批量采集进度
 */
export interface BatchCollectProgress {
  total: number;
  current: number;
  success: number;
  failed: number;
  currentUrl: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  results: CollectResult[];
}

/**
 * 单个采集结果
 */
export interface CollectResult {
  success: boolean;
  url: string;
  data?: PostEntity | AuthorEntity;
  error?: string;
}

/**
 * URL批量采集消息
 */
export interface UrlBatchCollectMessage {
  urls: string[];
}

/**
 * 批量采集控制消息
 */
export interface BatchCollectControlMessage {
  action: 'pause' | 'resume' | 'cancel';
}

/**
 * 批量采集进度更新消息
 */
export interface BatchCollectProgressMessage {
  progress: BatchCollectProgress;
}

/**
 * 批量采集配置
 */
export interface BatchCollectConfig {
  minInterval: number;
  maxInterval: number;
  maxRetries: number;
}

/**
 * 默认批量采集配置
 */
export const DEFAULT_BATCH_COLLECT_CONFIG: BatchCollectConfig = {
  minInterval: 3000,
  maxInterval: 10000,
  maxRetries: 3
};
