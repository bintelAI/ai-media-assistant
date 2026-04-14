import type { ParsedUrl } from '../types/batchCollect';
import type { Platform, PageType } from '../types';

/**
 * 解析URL识别平台和页面类型
 * @param url 原始URL
 * @returns 解析后的URL信息，无效URL返回null
 */
export function parseUrl(url: string): ParsedUrl | null {
  try {
    const trimmedUrl = url.trim();
    const urlObj = new URL(trimmedUrl);

    if (urlObj.hostname.includes('xiaohongshu.com')) {
      return parseXhsUrl(trimmedUrl);
    }

    if (urlObj.hostname.includes('douyin.com')) {
      return parseDouyinUrl(trimmedUrl);
    }

    if (urlObj.hostname.includes('kuaishou.com')) {
      return parseKuaishouUrl(trimmedUrl);
    }

    if (urlObj.hostname.includes('tiktok.com')) {
      return parseTiktokUrl(trimmedUrl);
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * 解析小红书URL
 * @param url 小红书URL
 * @returns 解析后的URL信息
 */
function parseXhsUrl(url: string): ParsedUrl | null {
  const postMatch = url.match(/xiaohongshu\.com\/explore\/([\w]+)/);
  if (postMatch) {
    return {
      platform: 'xhs' as Platform,
      pageType: 'post_detail' as PageType,
      id: postMatch[1],
      originalUrl: url
    };
  }

  const userMatch = url.match(/xiaohongshu\.com\/user\/profile\/([\w]+)/);
  if (userMatch) {
    const urlObj = new URL(url);
    return {
      platform: 'xhs' as Platform,
      pageType: 'author_profile' as PageType,
      id: userMatch[1],
      originalUrl: url,
      xsecSource: urlObj.searchParams.get('xsec_source') || undefined,
      xsecToken: urlObj.searchParams.get('xsec_token') || undefined
    };
  }

  return null;
}

/**
 * 解析抖音URL
 * @param url 抖音URL
 * @returns 解析后的URL信息
 */
function parseDouyinUrl(url: string): ParsedUrl | null {
  const videoMatch = url.match(/douyin\.com\/video\/(\d+)/);
  if (videoMatch) {
    return {
      platform: 'douyin' as Platform,
      pageType: 'post_detail' as PageType,
      id: videoMatch[1],
      originalUrl: url
    };
  }

  const userMatch = url.match(/douyin\.com\/user\/(MS4wLjABAAAA[\w-]+)/);
  if (userMatch) {
    return {
      platform: 'douyin' as Platform,
      pageType: 'author_profile' as PageType,
      id: userMatch[1],
      originalUrl: url
    };
  }

  return null;
}

/**
 * 解析快手URL
 * @param url 快手URL
 * @returns 解析后的URL信息
 */
function parseKuaishouUrl(url: string): ParsedUrl | null {
  const videoMatch = url.match(/kuaishou\.com\/short-video\/([\w]+)/);
  if (videoMatch) {
    return {
      platform: 'kuaishou' as Platform,
      pageType: 'post_detail' as PageType,
      id: videoMatch[1],
      originalUrl: url
    };
  }

  const userMatch = url.match(/kuaishou\.com\/profile\/([\w]+)/);
  if (userMatch) {
    return {
      platform: 'kuaishou' as Platform,
      pageType: 'author_profile' as PageType,
      id: userMatch[1],
      originalUrl: url
    };
  }

  return null;
}

/**
 * 解析TikTok URL
 * @param url TikTok URL
 * @returns 解析后的URL信息
 */
function parseTiktokUrl(url: string): ParsedUrl | null {
  const videoMatch = url.match(/tiktok\.com\/@[\w.]+\/video\/(\d+)/);
  if (videoMatch) {
    return {
      platform: 'tiktok' as Platform,
      pageType: 'post_detail' as PageType,
      id: videoMatch[1],
      originalUrl: url
    };
  }

  const userMatch = url.match(/tiktok\.com\/@([\w.]+)/);
  if (userMatch) {
    return {
      platform: 'tiktok' as Platform,
      pageType: 'author_profile' as PageType,
      id: userMatch[1],
      originalUrl: url
    };
  }

  return null;
}

/**
 * 批量解析URL
 * @param urls URL列表
 * @returns 解析结果列表，包含有效和无效的URL
 */
export function parseUrls(urls: string[]): { valid: ParsedUrl[]; invalid: string[] } {
  const valid: ParsedUrl[] = [];
  const invalid: string[] = [];

  for (const url of urls) {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) continue;

    const parsed = parseUrl(trimmedUrl);
    if (parsed) {
      valid.push(parsed);
    } else {
      invalid.push(trimmedUrl);
    }
  }

  return { valid, invalid };
}

/**
 * 获取平台的显示名称
 * @param platform 平台标识
 * @returns 平台显示名称
 */
export function getPlatformDisplayName(platform: Platform): string {
  const names: Record<Platform, string> = {
    xhs: '小红书',
    douyin: '抖音',
    kuaishou: '快手',
    xingtu: '星图',
    pgy: '蒲公英',
    tiktok: 'TikTok'
  };
  return names[platform] || platform;
}

/**
 * 获取页面类型的显示名称
 * @param pageType 页面类型
 * @returns 页面类型显示名称
 */
export function getPageTypeDisplayName(pageType: PageType): string {
  const names: Record<PageType, string> = {
    post_detail: '帖子详情',
    author_profile: '用户主页',
    comments_page: '评论页',
    feed_list: '推荐列表',
    search_result: '搜索结果',
    unknown: '未知'
  };
  return names[pageType] || pageType;
}
