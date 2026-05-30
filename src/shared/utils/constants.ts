import type { ExportFormat, PageType, Platform } from '../types';

export const DB_NAME = 'zhi-lian-cai-ji';
export const DB_VERSION = 1;

export const STORE_NAMES = {
  POSTS: 'posts',
  AUTHORS: 'authors',
  COMMENTS: 'comments',
  MEDIA: 'media',
  TASKS: 'tasks',
  TEMPLATES: 'templates'
} as const;

export const SETTINGS_STORAGE_KEY = 'zhi-lian-cai-ji-settings';

export interface AppSettings {
  defaultExportFormat: ExportFormat;
  autoDedupe: boolean;
  autoOpenSidePanel: boolean;
  taskConcurrency: number;
  retryCount: number;
  devMode: boolean;
  collectIntervalMinMs: number;
  collectIntervalMaxMs: number;
  downloadNamingRule: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultExportFormat: 'excel',
  autoDedupe: true,
  autoOpenSidePanel: false,
  taskConcurrency: 3,
  retryCount: 2,
  devMode: false,
  collectIntervalMinMs: 3000,
  collectIntervalMaxMs: 6000,
  downloadNamingRule: '{platform}_{author}_{date}_{title}'
};

export type StoredAppSettings = Partial<AppSettings> | { state?: Partial<AppSettings> };

export function unwrapStoredSettings(stored?: StoredAppSettings | null): Partial<AppSettings> {
  if (!stored) return {};
  if ('state' in stored && stored.state) return stored.state;
  return stored as Partial<AppSettings>;
}

export interface PlatformFeature {
  label: string;
  status: 'enabled' | 'disabled';
  url: string;
  batchCollectPageTypes: PageType[];
  disabledReason?: string;
}

export const PLATFORM_FEATURES: Record<Platform, PlatformFeature> = {
  xhs: {
    label: '小红书',
    status: 'enabled',
    url: 'https://www.xiaohongshu.com',
    batchCollectPageTypes: ['author_profile']
  },
  douyin: {
    label: '抖音',
    status: 'enabled',
    url: 'https://www.douyin.com',
    batchCollectPageTypes: []
  },
  kuaishou: {
    label: '快手',
    status: 'enabled',
    url: 'https://www.kuaishou.com',
    batchCollectPageTypes: []
  },
  tiktok: {
    label: 'TikTok',
    status: 'enabled',
    url: 'https://www.tiktok.com',
    batchCollectPageTypes: []
  },
  pgy: {
    label: '蒲公英',
    status: 'disabled',
    url: 'https://pgy.xiaohongshu.com',
    batchCollectPageTypes: ['author_profile', 'post_detail'],
    disabledReason: '暂未支持'
  },
  xingtu: {
    label: '星图',
    status: 'disabled',
    url: 'https://star.toutiao.com',
    batchCollectPageTypes: [],
    disabledReason: '暂未支持'
  }
};

export type PlatformFeatureKey = keyof typeof PLATFORM_FEATURES;

export function isPlatformFeatureEnabled(platform: PlatformFeatureKey): boolean {
  return PLATFORM_FEATURES[platform].status === 'enabled';
}

export function isBatchCollectSupported(platform: Platform, pageType: PageType, devMode = false): boolean {
  const feature = PLATFORM_FEATURES[platform];
  if (!feature) return false;
  if (feature.status !== 'enabled' && !devMode) return false;
  return feature.batchCollectPageTypes.includes(pageType);
}

export const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export const PLATFORM_ICONS = {
  xhs: '/icons/xhs.png',
  dy: '/icons/douyin.png',
  ks: '/icons/kuaishou.png',
  tiktok: '/icons/tiktok.png'
};

export const MAX_EXPORT_COUNT = 10000;
export const MAX_DOWNLOAD_CONCURRENCY = 5;
export const TASK_RETRY_DELAY = 1000;
