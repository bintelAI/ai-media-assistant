import type { AuthorEntity, PostEntity } from '@/shared/types/entities';
import { generatePgySign, generateTraceId } from '@/shared/utils/pgySign';

const PGY_BASE_URL = 'https://pgy.xiaohongshu.com';

interface PgyCreatorResponse {
  code: number;
  msg: string;
  data: {
    creator: {
      user_id: string;
      nickname: string;
      avatar?: { url: string };
      head_url?: string;
      image?: string;
      signature?: string;
      desc?: string;
      fans_count?: number;
      follower_count?: number;
      follow_count?: number;
      following_count?: number;
      liked_count?: number;
      total_liked_count?: number;
      note_count?: number;
      work_count?: number;
      verified?: boolean;
      verified_reason?: string;
    };
  };
}

async function pgyFetch(path: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(path, PGY_BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const pathWithQuery = url.pathname + url.search;
  const sign = generatePgySign(pathWithQuery);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json;charset=UTF-8',
    'x-s': sign['X-s'],
    'x-t': sign['X-t'],
    'x-b3-traceid': generateTraceId(),
  };

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.code && result.code !== 1000) {
    throw new Error(result.msg || '蒲公英接口请求失败');
  }

  return result;
}

export async function fetchPgyCreatorInfo(userId: string): Promise<Partial<AuthorEntity> | null> {
  console.log(`[智联AI] fetchPgyCreatorInfo 开始, userId: ${userId}`);

  try {
    const tabs = await chrome.tabs.query({ url: '*://pgy.xiaohongshu.com/*' });

    if (tabs.length > 0) {
      const activeTab = tabs.find(tab => tab.active && tab.id) || tabs[0];

      if (activeTab.id) {
        console.log(`[智联AI] 通过蒲公英标签页 API 获取用户信息: ${activeTab.id}`);

        const response = await chrome.tabs.sendMessage(activeTab.id, {
          type: 'pgy:api:call',
          method: 'GET',
          path: '/api/creator/home',
          params: { user_id: userId },
        });

        if (response?.success && response?.data?.data?.creator) {
          const creator = response.data.data.creator;
          return mapCreatorToAuthor(creator);
        }
      }
    }

    console.log('[智联AI] 没有蒲公英标签页，尝试直接调用API');
    return await fetchPgyCreatorDirectly(userId);
  } catch (error) {
    console.error('[智联AI] 获取蒲公英用户信息异常:', error);
    return null;
  }
}

async function fetchPgyCreatorDirectly(userId: string): Promise<Partial<AuthorEntity> | null> {
  try {
    const result = await pgyFetch('/api/creator/home', { user_id: userId });
    const creator = result?.data?.creator;

    if (!creator) {
      console.warn('[智联AI] 蒲公英直接API返回数据为空');
      return null;
    }

    return mapCreatorToAuthor(creator);
  } catch (error) {
    console.error('[智联AI] 蒲公英直接API调用失败:', error);
    return null;
  }
}

function mapCreatorToAuthor(creator: any): Partial<AuthorEntity> {
  return {
    platform: 'pgy',
    authorId: creator.user_id || creator.id,
    name: creator.nickname || creator.name || '',
    avatar: creator.avatar?.url || creator.head_url || creator.image,
    profileUrl: `https://www.xiaohongshu.com/user/profile/${creator.user_id || creator.id}`,
    bio: creator.signature || creator.desc,
    fansCount: creator.fans_count || creator.follower_count,
    followCount: creator.follow_count || creator.following_count,
    likedCount: creator.liked_count || creator.total_liked_count,
    workCount: creator.note_count || creator.work_count,
    verified: !!creator.verified,
    verifiedDesc: creator.verified_reason,
  };
}

export async function fetchPgyPostDetail(noteId: string): Promise<Partial<PostEntity> | null> {
  console.log(`[智联AI] fetchPgyPostDetail 开始, noteId: ${noteId}`);

  try {
    const tabs = await chrome.tabs.query({ url: '*://pgy.xiaohongshu.com/*' });

    if (tabs.length > 0) {
      const activeTab = tabs.find(tab => tab.active && tab.id) || tabs[0];

      if (activeTab.id) {
        console.log(`[智联AI] 通过蒲公英标签页 API 获取帖子详情: ${activeTab.id}`);

        const response = await chrome.tabs.sendMessage(activeTab.id, {
          type: 'pgy:api:call',
          method: 'GET',
          path: '/api/note/detail',
          params: { note_id: noteId },
        });

        if (response?.success && response?.data?.data?.note) {
          const note = response.data.data.note;
          return mapNoteToPost(note);
        }
      }
    }

    console.log('[智联AI] 没有蒲公英标签页，尝试直接调用API');
    return await fetchPgyPostDetailDirectly(noteId);
  } catch (error) {
    console.error('[智联AI] 获取蒲公英帖子详情异常:', error);
    return null;
  }
}

async function fetchPgyPostDetailDirectly(noteId: string): Promise<Partial<PostEntity> | null> {
  try {
    const result = await pgyFetch('/api/note/detail', { note_id: noteId });
    const note = result?.data?.note;

    if (!note) {
      console.warn('[智联AI] 蒲公英直接API返回帖子数据为空');
      return null;
    }

    return mapNoteToPost(note);
  } catch (error) {
    console.error('[智联AI] 蒲公英直接API获取帖子详情失败:', error);
    return null;
  }
}

function mapNoteToPost(note: any): Partial<PostEntity> {
  const author = note.author || note.user || {};
  return {
    platform: 'pgy',
    postId: note.note_id || note.id,
    postType: note.type === 'video' ? 'video' : 'image',
    title: note.title || note.display_title || '',
    content: note.desc || note.description || '',
    url: note.share_info?.url || `https://www.xiaohongshu.com/explore/${note.note_id || note.id}`,
    coverUrl: note.cover?.url || note.image_list?.[0]?.url,
    publishTime: note.time ? new Date(note.time * 1000).toISOString() : undefined,
    authorId: author.user_id || author.id,
    authorName: author.nickname || author.name,
    authorUrl: author.user_id ? `https://www.xiaohongshu.com/user/profile/${author.user_id}` : undefined,
    likeCount: note.like_count || note.interact_info?.like_count,
    commentCount: note.comment_count || note.interact_info?.comment_count,
    collectCount: note.collect_count || note.interact_info?.collect_count,
    shareCount: note.share_count || note.interact_info?.share_count,
    viewCount: note.view_count,
    mediaCount: note.image_list?.length || 1,
    tags: note.tag_list?.map((t: any) => t.name || t).filter(Boolean) || [],
  };
}

export async function batchFetchPgyCreators(
  userIds: string[],
  concurrency: number = 3
): Promise<Partial<AuthorEntity>[]> {
  const results: Partial<AuthorEntity>[] = [];

  for (let i = 0; i < userIds.length; i += concurrency) {
    const batch = userIds.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(userId => fetchPgyCreatorInfo(userId))
    );

    results.push(...batchResults.filter((r): r is Partial<AuthorEntity> => r !== null));

    if (i + concurrency < userIds.length) {
      await delay(500);
    }
  }

  return results;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
