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

export const DEFAULT_SETTINGS = {
  defaultExportFormat: 'excel' as const,
  autoDedupe: true,
  autoOpenSidePanel: false,
  taskConcurrency: 3,
  retryCount: 2,
  downloadNamingRule: '{platform}_{author}_{date}_{title}'
};

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
