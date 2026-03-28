import type { Platform, PageType } from '../types';

export interface PlatformConfig {
  name: Platform;
  displayName: string;
  domains: string[];
  color: string;
  icon?: string;
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  xhs: {
    name: 'xhs',
    displayName: '小红书',
    domains: ['www.xiaohongshu.com', 'xiaohongshu.com'],
    color: '#ff2442'
  },
  dy: {
    name: 'dy',
    displayName: '抖音',
    domains: ['www.douyin.com', 'douyin.com'],
    color: '#000000'
  },
  ks: {
    name: 'ks',
    displayName: '快手',
    domains: ['www.kuaishou.com', 'kuaishou.com'],
    color: '#ff4906'
  },
  tiktok: {
    name: 'tiktok',
    displayName: 'TikTok',
    domains: ['www.tiktok.com', 'tiktok.com'],
    color: '#000000'
  }
};

export function getPlatformFromUrl(url: string): Platform | null {
  try {
    const hostname = new URL(url).hostname;
    for (const [platform, config] of Object.entries(PLATFORM_CONFIGS)) {
      if (config.domains.includes(hostname)) {
        return platform as Platform;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function getPageTypeLabel(pageType: PageType): string {
  const labels: Record<PageType, string> = {
    post_detail: '帖子详情',
    author_profile: '作者主页',
    comments_page: '评论页',
    feed_list: '推荐列表',
    search_result: '搜索结果',
    unknown: '未知'
  };
  return labels[pageType];
}
