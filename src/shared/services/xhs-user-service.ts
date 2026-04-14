import type { AuthorEntity } from '@/shared/types/entities';

/**
 * 小红书用户信息 API 响应结构
 */
interface XhsUserOtherInfoResponse {
  success: boolean;
  data?: {
    user?: {
      userId: string;
      nickname: string;
      image: string;
      desc?: string;
      fansCount?: number;
      followCount?: number;
      likedCount?: number;
      noteCount?: number;
      location?: string;
      verified?: boolean;
      verifiedInfo?: {
        desc?: string;
      };
    };
  };
  msg?: string;
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

    const result: XhsUserOtherInfoResponse = response.data;

    if (!result.success || !result.data?.user) {
      console.error('[智联AI] 获取用户信息失败:', result.msg);
      return null;
    }

    const user = result.data.user;

    return {
      platform: 'xhs',
      authorId: user.userId,
      name: user.nickname || '',
      avatar: user.image,
      profileUrl: `https://www.xiaohongshu.com/user/profile/${user.userId}`,
      bio: user.desc,
      fansCount: user.fansCount,
      followCount: user.followCount,
      likedCount: user.likedCount,
      workCount: user.noteCount,
      location: user.location,
      verified: !!user.verified,
      verifiedDesc: user.verifiedInfo?.desc,
      sourcePageUrl: `https://www.xiaohongshu.com/user/profile/${user.userId}`
    };
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
