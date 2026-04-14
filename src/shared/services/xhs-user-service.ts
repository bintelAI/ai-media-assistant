import type { AuthorEntity } from '@/shared/types/entities';

/**
 * 小红书用户信息 API 响应结构（实际格式）
 */
interface XhsUserOtherInfoResponse {
  success: boolean;
  msg: string;
  code: number;
  data: {
    basicInfo: {
      nickname: string;
      images: string;
      imageb: string;
      red_id: string;
      gender: number;
      ip_location: string;
      desc: string;
    };
    interactions: Array<{
      type: string;
      name: string;
      count: string;
    }>;
    tab_public: {
      collection: boolean;
      collectionNote: { count: number; display: boolean; lock: boolean };
      collectionBoard: { display: boolean; lock: boolean; count: number };
      collectionFile: { display: boolean; lock: boolean; count: number };
    };
    extra_info: {
      blockType: string;
      fstatus: string;
    };
    result: {
      message: string;
      success: boolean;
      code: number;
    };
    tags: Array<{
      icon?: string;
      tagType: string;
    }>;
  };
}

/**
 * 解析数量字符串（如 "1千+" -> 1000, "1万+" -> 10000）
 * @param countStr 数量字符串
 * @returns 数字或 undefined
 */
function parseCountString(countStr: string): number | undefined {
  if (!countStr) return undefined;

  const cleanStr = countStr.replace(/[+\s]/g, '');

  if (cleanStr.includes('万')) {
    const num = parseFloat(cleanStr.replace('万', ''));
    return Number.isFinite(num) ? Math.round(num * 10000) : undefined;
  }

  if (cleanStr.includes('千')) {
    const num = parseFloat(cleanStr.replace('千', ''));
    return Number.isFinite(num) ? Math.round(num * 1000) : undefined;
  }

  const num = parseFloat(cleanStr);
  return Number.isFinite(num) ? Math.round(num) : undefined;
}

/**
 * 从 interactions 数组中获取指定类型的数量
 * @param interactions interactions 数组
 * @param type 类型（follows, fans, interaction）
 * @returns 数量或 undefined
 */
function getInteractionCount(
  interactions: XhsUserOtherInfoResponse['data']['interactions'],
  type: string
): number | undefined {
  const item = interactions?.find(i => i.type === type);
  return item ? parseCountString(item.count) : undefined;
}

/**
 * 清理 URL 字符串（移除反引号等）
 * @param url URL 字符串
 * @returns 清理后的 URL
 */
function cleanUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url.replace(/[`]/g, '').trim() || undefined;
}

/**
 * 通过 Content Script 的 MAIN world 调用小红书原生 API
 * @param userId 用户 ID
 * @param xsecSource xsec_source 参数（来自页面 URL）
 * @param xsecToken xsec_token 参数（来自页面 URL）
 * @returns 用户信息或 null
 */
export async function fetchUserOtherInfo(
  userId: string,
  xsecSource?: string,
  xsecToken?: string
): Promise<Partial<AuthorEntity> | null> {
  console.log(`[智联AI] fetchUserOtherInfo 开始, userId: ${userId}, xsecSource: ${xsecSource}, xsecToken: ${xsecToken ? '***' : 'undefined'}`);

  try {
    const tabs = await chrome.tabs.query({ url: '*://www.xiaohongshu.com/*' });

    console.log(`[智联AI] 找到 ${tabs.length} 个小红书标签页`);

    if (tabs.length === 0) {
      console.warn('[智联AI] 没有找到小红书标签页');
      return null;
    }

    const activeTab = tabs.find(tab => tab.active && tab.id) || tabs[0];

    if (!activeTab.id) {
      console.warn('[智联AI] 标签页没有有效的 ID');
      return null;
    }

    console.log(`[智联AI] 使用标签页: ${activeTab.id}, url: ${activeTab.url}`);

    const params: Record<string, string> = {
      target_user_id: userId
    };

    if (xsecSource) {
      params.xsec_source = xsecSource;
    }
    if (xsecToken) {
      params.xsec_token = xsecToken;
    }

    console.log(`[智联AI] 发送消息到标签页 ${activeTab.id}`);

    const response = await chrome.tabs.sendMessage(activeTab.id, {
      type: 'xhs:api:call',
      method: 'GET',
      path: '/api/sns/web/v1/user/otherinfo',
      params
    });

    console.log(`[智联AI] 收到响应:`, response);

    if (!response || !response.success) {
      console.error('[智联AI] API 调用失败:', response?.error);
      return null;
    }

    const result: XhsUserOtherInfoResponse = response;
    console.log(`[智联AI] 获取用户信息成功:`, result);
    if (!result.data?.basicInfo) {
      console.error('[智联AI] 获取用户信息失败:', result.msg);
      return null;
    }

    const basicInfo = result.data.basicInfo;
    const interactions = result.data.interactions || [];

    const authorData: Partial<AuthorEntity> = {
      platform: 'xhs',
      authorId: userId,
      name: basicInfo.nickname || '',
      avatar: cleanUrl(basicInfo.images),
      profileUrl: `https://www.xiaohongshu.com/user/profile/${userId}`,
      bio: basicInfo.desc,
      fansCount: getInteractionCount(interactions, 'fans'),
      followCount: getInteractionCount(interactions, 'follows'),
      likedCount: getInteractionCount(interactions, 'interaction'),
      location: basicInfo.ip_location || undefined,
      sourcePageUrl: `https://www.xiaohongshu.com/user/profile/${userId}`
    };

    console.log(`[智联AI] 解析用户信息成功:`, authorData);

    return authorData;
  } catch (error) {
    console.error('[智联AI] 获取用户信息异常:', error);
    return null;
  }
}

/**
 * 批量获取用户信息
 * @param userIds 用户 ID 列表
 * @param concurrency 并发数（默认 3，避免请求过快）
 * @returns 用户信息列表
 */
export async function batchFetchUserOtherInfo(
  userIds: string[],
  concurrency: number = 3
): Promise<Partial<AuthorEntity>[]> {
  const results: Partial<AuthorEntity>[] = [];

  for (let i = 0; i < userIds.length; i += concurrency) {
    const batch = userIds.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(userId => fetchUserOtherInfo(userId))
    );

    results.push(...batchResults.filter((r): r is Partial<AuthorEntity> => r !== null));

    if (i + concurrency < userIds.length) {
      await delay(500);
    }
  }

  return results;
}

/**
 * 延迟函数
 * @param ms 毫秒数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
