import type { AuthorEntity, PostEntity } from '@/shared/types/entities';

type XhsApiMethod = 'GET' | 'POST';

interface XhsApiCallPayload {
  method: XhsApiMethod;
  path: string;
  params?: Record<string, unknown>;
}

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

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const cleanValue = value.replace(/[,+\s]/g, '');
    const num = parseFloat(cleanValue.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(num)) return undefined;

    if (cleanValue.includes('亿')) return Math.round(num * 100000000);
    if (cleanValue.includes('万')) return Math.round(num * 10000);
    if (cleanValue.includes('千')) return Math.round(num * 1000);
    return Math.round(num);
  }

  return undefined;
}

function toIsoTime(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;

  const timestamp = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(timestamp)) return undefined;

  const normalized = timestamp < 1000000000000 ? timestamp * 1000 : timestamp;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeXhsUser(raw: any): { userId?: string; nickname?: string; name?: string; avatar?: string } {
  if (!raw || typeof raw !== 'object') return {};

  return {
    userId: raw.userId ?? raw.user_id ?? raw.id ?? raw.userid,
    nickname: raw.nickname ?? raw.nick_name,
    name: raw.name,
    avatar: raw.avatar ?? raw.image,
  };
}

function normalizeXhsInteractInfo(raw: any): {
  likeCount?: number;
  commentCount?: number;
  collectCount?: number;
  shareCount?: number;
} {
  if (!raw || typeof raw !== 'object') return {};

  return {
    likeCount: toNumber(raw.likeCount ?? raw.liked_count ?? raw.likedCount),
    commentCount: toNumber(raw.commentCount ?? raw.comment_count ?? raw.commentCount),
    collectCount: toNumber(raw.collectCount ?? raw.collect_count ?? raw.collected_count),
    shareCount: toNumber(raw.shareCount ?? raw.share_count),
  };
}

function normalizeXhsNote(input: any): any | null {
  if (!input || typeof input !== 'object') return null;

  const card = input.note_card ?? input.noteCard;
  const base = input.note ?? input;
  const merged = card && typeof card === 'object' ? { ...base, ...card } : base;
  const noteId = merged.noteId ?? merged.note_id ?? input.noteId ?? input.note_id ?? input.id ?? merged.id;
  if (!noteId) return null;

  return {
    ...merged,
    noteId,
    user: merged.user ?? card?.user ?? input.user,
    interactInfo: merged.interactInfo ?? merged.interact_info ?? card?.interactInfo ?? card?.interact_info,
    cover: merged.cover ?? card?.cover,
    displayTitle: merged.displayTitle ?? merged.display_title,
  };
}

function extractXhsPostData(note: any, sourcePageUrl?: string): Partial<PostEntity> | null {
  const normalizedNote = normalizeXhsNote(note);
  if (!normalizedNote?.noteId) return null;

  const user = normalizeXhsUser(normalizedNote.user);
  const interactInfo = normalizeXhsInteractInfo(normalizedNote.interactInfo);
  const cover = normalizedNote.cover || {};
  const imageList = normalizedNote.imageList || normalizedNote.image_list || [];
  const tagList = normalizedNote.tagList || normalizedNote.tag_list || [];
  const title = normalizedNote.title || normalizedNote.displayTitle || normalizedNote.display_title || '';
  const coverUrl =
    cleanUrl(imageList?.[0]?.urlDefault ?? imageList?.[0]?.url_default) ||
    cleanUrl(cover?.urlDefault ?? cover?.url_default) ||
    cleanUrl(cover?.urlPre ?? cover?.url_pre) ||
    cleanUrl(cover?.infoList?.find((x: any) => x?.image_scene === 'WB_DFT')?.url) ||
    cleanUrl(cover?.info_list?.find((x: any) => x?.image_scene === 'WB_DFT')?.url);

  return {
    platform: 'xhs',
    postId: String(normalizedNote.noteId),
    postType: normalizedNote.type === 'video' || normalizedNote.video ? 'video' : 'image',
    title,
    content: normalizedNote.desc || normalizedNote.content || '',
    url: `https://www.xiaohongshu.com/explore/${normalizedNote.noteId}`,
    coverUrl,
    publishTime: toIsoTime(normalizedNote.time ?? normalizedNote.create_time ?? normalizedNote.createTime),
    authorId: user.userId ? String(user.userId) : undefined,
    authorName: user.nickname || user.name,
    authorUrl: user.userId ? `https://www.xiaohongshu.com/user/profile/${user.userId}` : undefined,
    likeCount: interactInfo.likeCount,
    commentCount: interactInfo.commentCount,
    collectCount: interactInfo.collectCount,
    shareCount: interactInfo.shareCount,
    mediaCount: Array.isArray(imageList) && imageList.length > 0 ? imageList.length : normalizedNote.video ? 1 : undefined,
    tags: Array.isArray(tagList) ? tagList.map((tag: any) => tag?.name || tag).filter(Boolean) : [],
    sourcePageUrl: sourcePageUrl || `https://www.xiaohongshu.com/explore/${normalizedNote.noteId}`,
    sourcePageType: 'post_detail'
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

async function getXhsApiTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ url: '*://www.xiaohongshu.com/*' });
  const existingTab = tabs.find(tab => tab.active && tab.id) || tabs.find(tab => tab.id);

  if (existingTab) {
    return existingTab;
  }

  const createdTab = await chrome.tabs.create({
    url: 'https://www.xiaohongshu.com/',
    active: false
  });

  if (createdTab.id) {
    await waitForTabComplete(createdTab.id);
    await delay(1500);
  }

  return createdTab;
}

function unwrapXhsApiPayload<T>(response: any): T | null {
  if (!response) return null;
  if (response.success === false) {
    throw new Error(response.error || '小红书 API 调用失败');
  }

  let payload = response.data ?? response;

  if (payload?.status !== undefined && payload?.data !== undefined) {
    payload = payload.data;
  }

  return payload as T;
}

async function sendXhsApiCall<T>(payload: XhsApiCallPayload): Promise<T | null> {
  const tab = await getXhsApiTab();
  if (!tab?.id) {
    console.warn('[智联AI] 没有可用的小红书标签页');
    return null;
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'xhs:api:call',
        method: payload.method,
        path: payload.path,
        params: payload.params
      });
      return unwrapXhsApiPayload<T>(response);
    } catch (error) {
      lastError = error;
      await delay(800 * (attempt + 1));
    }
  }

  console.error('[智联AI] 小红书 API 消息发送失败:', lastError);
  return null;
}

function getFirstNoteFromFeedResult(result: any): any | null {
  if (!result || result.success === false || (typeof result.code === 'number' && result.code !== 0)) {
    return null;
  }

  const root = result.data ?? result;
  const items = root?.items || root?.notes || [];
  if (Array.isArray(items) && items.length > 0) {
    return items[0];
  }

  return root?.note || root?.note_card || root;
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
    const params: Record<string, string> = {
      target_user_id: userId
    };

    if (xsecSource) {
      params.xsec_source = xsecSource;
    }
    if (xsecToken) {
      params.xsec_token = xsecToken;
    }

    const result = await sendXhsApiCall<XhsUserOtherInfoResponse>({
      method: 'GET',
      path: '/api/sns/web/v1/user/otherinfo',
      params
    });

    console.log(`[智联AI] 获取用户信息成功:`, result);
    if (!result?.data?.basicInfo) {
      console.error('[智联AI] 获取用户信息失败:', result?.msg);
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

export async function fetchXhsNoteDetail(
  noteId: string,
  xsecSource?: string,
  xsecToken?: string,
  sourcePageUrl?: string
): Promise<Partial<PostEntity> | null> {
  console.log(`[智联AI] fetchXhsNoteDetail 开始, noteId: ${noteId}`);

  try {
    const params: Record<string, unknown> = {
      source_note_id: noteId,
      image_formats: ['jpg', 'webp', 'avif'],
      extra: { need_body_topic: '1' },
      xsec_source: xsecSource || 'pc_feed'
    };

    if (xsecToken) {
      params.xsec_token = xsecToken;
    }

    const result = await sendXhsApiCall<any>({
      method: 'POST',
      path: '/api/sns/web/v1/feed',
      params
    });

    const note = getFirstNoteFromFeedResult(result);
    const postData = extractXhsPostData(note, sourcePageUrl);

    if (!postData?.postId) {
      console.error('[智联AI] 获取笔记详情失败:', result);
      return null;
    }

    console.log(`[智联AI] 解析笔记详情成功:`, postData);
    return postData;
  } catch (error) {
    console.error('[智联AI] 获取笔记详情异常:', error);
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
