import type { AuthorEntity, PostEntity } from '@/shared/types/entities';
import type { DouyinContextCheckResult } from '@/shared/types/messages';

type DouyinApiMethod = 'GET' | 'POST';

interface DouyinApiCallPayload {
  method: DouyinApiMethod;
  path: string;
  params?: Record<string, unknown>;
}

interface DouyinPingResponse {
  ok?: boolean;
  href?: string;
  readyState?: string;
  hasBridge?: boolean;
  hasGet?: boolean;
  hasPost?: boolean;
  error?: string;
  action?: DouyinContextCheckResult['action'];
}

function createDouyinContextError(
  error: string,
  action: DouyinContextCheckResult['action'],
  tabId?: number,
  extra?: Partial<DouyinContextCheckResult>
): DouyinContextCheckResult {
  return {
    ok: false,
    tabId,
    error,
    action,
    ...extra,
  };
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;

  const cleanValue = value.replace(/[,+\s]/g, '');
  const num = parseFloat(cleanValue.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(num)) return undefined;

  if (cleanValue.includes('亿')) return Math.round(num * 100000000);
  if (cleanValue.includes('万')) return Math.round(num * 10000);
  if (cleanValue.includes('千')) return Math.round(num * 1000);
  return Math.round(num);
}

function toIsoTime(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const timestamp = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(timestamp)) return undefined;
  const normalized = timestamp < 1000000000000 ? timestamp * 1000 : timestamp;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function firstUrl(input: any): string | undefined {
  if (!input) return undefined;
  if (typeof input === 'string') return input;
  if (Array.isArray(input?.url_list)) return input.url_list.find(Boolean);
  if (Array.isArray(input)) return input.find(Boolean);
  return input.url || input.uri;
}

function getAuthorPrimaryId(user: any): string {
  return String(user?.uid || user?.id || user?.user_id || user?.sec_uid || user?.secUid || '').trim();
}

function getDouyinProfilePathId(user: any): string {
  return String(
    user?.sec_uid ||
    user?.secUid ||
    user?.web_rid ||
    user?.webRid ||
    user?.unique_id ||
    user?.uniqueId ||
    getAuthorPrimaryId(user)
  ).trim();
}

function unwrapDouyinPayload(response: any): any {
  if (!response) return null;
  if (response.success === false) {
    throw new Error(response.error || '抖音 API 调用失败');
  }

  let payload = response.data ?? response;
  if (payload?.data && (payload?.status_code === undefined || payload?.aweme_detail === undefined)) {
    payload = payload.data;
  }
  return payload;
}

function mapDouyinAuthor(user: any, sourcePageUrl?: string, fallbackId?: string): Partial<AuthorEntity> | null {
  if (!user) return null;
  const authorId = getAuthorPrimaryId(user) || fallbackId || '';
  if (!authorId) return null;

  const profilePathId = getDouyinProfilePathId(user) || fallbackId || authorId;
  const name = user.nickname || user.name || user.unique_id || user.short_id || '';

  return {
    platform: 'douyin',
    authorId,
    name,
    avatar:
      firstUrl(user.avatar_medium) ||
      firstUrl(user.avatar_thumb) ||
      firstUrl(user.avatar_larger) ||
      user.avatar_url,
    profileUrl: `https://www.douyin.com/user/${profilePathId}`,
    bio: user.signature || user.desc,
    fansCount: toNumber(user.follower_count ?? user.mplatform_followers_count),
    followCount: toNumber(user.following_count),
    likedCount: toNumber(user.total_favorited ?? user.favoriting_count),
    workCount: toNumber(user.aweme_count),
    location: user.ip_location,
    verified: Boolean(user.verification_type || user.enterprise_verify_reason || user.custom_verify),
    verifiedDesc: user.verification_reason || user.enterprise_verify_reason || user.custom_verify,
    sourcePageUrl: sourcePageUrl || `https://www.douyin.com/user/${profilePathId}`,
    extra: {
      secUid: user.sec_uid || user.secUid,
      uniqueId: user.unique_id || user.uniqueId,
      shortId: user.short_id || user.shortId,
      webRid: user.web_rid || user.webRid,
    },
  };
}

function mapDouyinPost(aweme: any, sourcePageUrl?: string): Partial<PostEntity> | null {
  if (!aweme?.aweme_id) return null;

  const author = aweme.author || {};
  const statistics = aweme.statistics || {};
  const video = aweme.video || {};
  const hasVideo = Boolean(
    video?.play_addr ||
    video?.download_addr ||
    video?.bit_rate?.length ||
    video?.cover?.url_list?.length
  );
  const hasImages = Array.isArray(aweme.images) && aweme.images.length > 0;
  const authorId = getAuthorPrimaryId(author);
  const profilePathId = getDouyinProfilePathId(author);
  const postType = hasVideo ? 'video' : hasImages ? 'image' : 'video';

  return {
    platform: 'douyin',
    postId: String(aweme.aweme_id),
    postType,
    title: aweme.desc || aweme.title || '',
    content: aweme.desc || '',
    url: `https://www.douyin.com/${postType === 'image' ? 'note' : 'video'}/${aweme.aweme_id}`,
    coverUrl:
      firstUrl(video?.cover) ||
      firstUrl(video?.origin_cover) ||
      firstUrl(video?.dynamic_cover) ||
      firstUrl(aweme.cover) ||
      firstUrl(aweme.images?.[0]),
    publishTime: toIsoTime(aweme.create_time ?? aweme.createTime),
    authorId: authorId || undefined,
    authorName: author.nickname || author.name,
    authorUrl: profilePathId ? `https://www.douyin.com/user/${profilePathId}` : undefined,
    likeCount: toNumber(statistics.digg_count ?? statistics.like_count),
    commentCount: toNumber(statistics.comment_count),
    collectCount: toNumber(statistics.collect_count),
    shareCount: toNumber(statistics.share_count),
    viewCount: toNumber(statistics.play_count),
    mediaCount: Array.isArray(aweme.images) && aweme.images.length > 0 ? aweme.images.length : 1,
    tags: Array.isArray(aweme.text_extra)
      ? aweme.text_extra.map((tag: any) => tag?.hashtag_name || tag?.hashtagName).filter(Boolean)
      : [],
    sourcePageUrl: sourcePageUrl || `https://www.douyin.com/video/${aweme.aweme_id}`,
    sourcePageType: 'post_detail',
    extra: {
      secUid: author.sec_uid || author.secUid,
      mediaType: aweme.media_type,
      duration: aweme.duration,
    },
  };
}

function waitForTabComplete(tabId: number, timeout = 15000): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }, timeout);

    const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete' && !done) {
        done = true;
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete' && !done) {
        done = true;
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }).catch(() => undefined);
  });
}

async function getDouyinApiTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ url: '*://www.douyin.com/*' });
  const existingTab = tabs.find(tab => tab.active && tab.id) || tabs.find(tab => tab.id);
  if (existingTab) return existingTab;

  const createdTab = await chrome.tabs.create({
    url: 'https://www.douyin.com/',
    active: false,
  });

  if (createdTab.id) {
    await waitForTabComplete(createdTab.id);
    await delay(1800);
  }

  return createdTab;
}

async function pingDouyinApiTab(tabId: number): Promise<DouyinContextCheckResult> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'douyin:api:ping',
    }) as { success?: boolean; data?: DouyinPingResponse; error?: string };

    const data = response?.data || {};
    const hasBridge = Boolean(data.hasBridge || data.hasGet || data.hasPost);

    if (!response?.success || !hasBridge) {
      return createDouyinContextError(
        data.error || response?.error || '抖音页面请求函数未就绪，请等待页面加载完成后重试',
        data.action || 'retry_later',
        tabId,
        {
          href: data.href,
          readyState: data.readyState,
          hasBridge,
          hasGet: Boolean(data.hasGet),
          hasPost: Boolean(data.hasPost),
        }
      );
    }

    return {
      ok: true,
      tabId,
      href: data.href,
      readyState: data.readyState,
      hasBridge: true,
      hasGet: Boolean(data.hasGet),
      hasPost: Boolean(data.hasPost),
    };
  } catch (error) {
    return createDouyinContextError(
      error instanceof Error && error.message
        ? '抖音页面插件脚本未就绪，请刷新抖音页面后重试'
        : '无法连接抖音页面，请刷新抖音页面后重试',
      'refresh_douyin',
      tabId
    );
  }
}

export async function ensureDouyinApiContext(): Promise<DouyinContextCheckResult> {
  let tab: chrome.tabs.Tab | null = null;
  try {
    tab = await getDouyinApiTab();
  } catch {
    return createDouyinContextError('无法打开抖音页面，请手动打开抖音后重试', 'open_douyin');
  }

  if (!tab?.id) {
    return createDouyinContextError('没有可用的抖音页面，请手动打开抖音后重试', 'open_douyin');
  }

  await waitForTabComplete(tab.id);

  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await pingDouyinApiTab(tab.id);
    if (result.ok) return result;

    if (attempt === 0 && result.action === 'refresh_douyin') {
      try {
        await chrome.tabs.reload(tab.id);
        await waitForTabComplete(tab.id);
      } catch {
        return result;
      }
    }

    if (attempt < 2) {
      await delay(1000 + attempt * 700);
      continue;
    }

    return result;
  }

  return createDouyinContextError('抖音页面请求函数未就绪，请刷新抖音页面后重试', 'retry_later', tab.id);
}

async function sendDouyinApiCall<T>(payload: DouyinApiCallPayload): Promise<T | null> {
  const tab = await getDouyinApiTab();
  if (!tab?.id) {
    console.warn('[智联AI] 没有可用的抖音标签页');
    return null;
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'douyin:api:call',
        method: payload.method,
        path: payload.path,
        params: payload.params,
      });
      return unwrapDouyinPayload(response) as T;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error || '');
      if (message.includes('请先登录抖音账号') || message.includes('black_no_login')) {
        throw new Error('请先登录抖音账号后再批量采集');
      }
      await delay(900 * (attempt + 1));
    }
  }

  console.error('[智联AI] 抖音 API 消息发送失败', lastError);
  if (lastError instanceof Error && lastError.message) {
    throw lastError;
  }
  return null;
}

export async function fetchDouyinAuthorInfo(secUserId: string): Promise<Partial<AuthorEntity> | null> {
  console.log(`[智联AI] fetchDouyinAuthorInfo 开始, secUserId: ${secUserId}`);

  try {
    const result = await sendDouyinApiCall<any>({
      method: 'GET',
      path: '/aweme/v1/web/user/profile/other/',
      params: {
        sec_user_id: secUserId,
        source: 'channel_pc_web',
        publish_video_strategy_type: 2,
        personal_center_strategy: 1,
        profile_other_record_enable: 1,
        land_to: 1,
      },
    });

    const user = result?.user || result?.data?.user || result?.user_info || result?.data?.user_info;
    const author = mapDouyinAuthor(user, `https://www.douyin.com/user/${secUserId}`, secUserId);
    if (!author?.authorId) {
      console.error('[智联AI] 抖音作者详情解析失败:', result);
      return null;
    }

    return author;
  } catch (error) {
    console.error('[智联AI] 抖音作者详情获取异常:', error);
    return null;
  }
}

export async function fetchDouyinAwemeDetail(
  awemeId: string,
  sourcePageUrl?: string
): Promise<Partial<PostEntity> | null> {
  console.log(`[智联AI] fetchDouyinAwemeDetail 开始, awemeId: ${awemeId}`);

  try {
    const result = await sendDouyinApiCall<any>({
      method: 'GET',
      path: '/aweme/v1/web/aweme/detail/',
      params: { aweme_id: awemeId },
    });

    const aweme = result?.aweme_detail || result?.data?.aweme_detail || result?.aweme || result?.data?.aweme;
    const post = mapDouyinPost(aweme, sourcePageUrl);
    if (!post?.postId) {
      console.error('[智联AI] 抖音作品详情解析失败:', result);
      return null;
    }

    return post;
  } catch (error) {
    console.error('[智联AI] 抖音作品详情获取异常:', error);
    return null;
  }
}

export async function batchFetchDouyinAuthors(
  secUserIds: string[],
  concurrency: number = 3
): Promise<Partial<AuthorEntity>[]> {
  const results: Partial<AuthorEntity>[] = [];

  for (let i = 0; i < secUserIds.length; i += concurrency) {
    const batch = secUserIds.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(secUserId => fetchDouyinAuthorInfo(secUserId)));
    results.push(...batchResults.filter((r): r is Partial<AuthorEntity> => r !== null));

    if (i + concurrency < secUserIds.length) {
      await delay(600);
    }
  }

  return results;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
