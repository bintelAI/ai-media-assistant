import type { PageType, Platform } from '@/shared/types';
import type { ExtractResult } from '@/shared/types/platforms';
import type { PostEntity, AuthorEntity, CommentEntity, MediaEntity } from '@/shared/types/entities';

export function detectXHSPage(url: string): PageType {
  if (url.match(/\/explore\/[\w]+/)) {
    return 'post_detail';
  }
  
  if (url.match(/\/user\/profile\/[\w]+/)) {
    return 'author_profile';
  }
  
  if (url.includes('/search_result/')) {
    return 'search_result';
  }
  
  if (url === 'https://www.xiaohongshu.com' || 
      url.includes('/explore?type=') ||
      url.includes('/explore?')) {
    return 'feed_list';
  }
  
  return 'unknown';
}

export function extractPostIdFromUrl(url: string): string | null {
  const match = url.match(/\/explore\/([\w]+)/);
  return match ? match[1] : null;
}

export function extractAuthorIdFromUrl(url: string): string | null {
  const match = url.match(/\/user\/profile\/([\w]+)/);
  return match ? match[1] : null;
}

export async function extractPost(): Promise<ExtractResult<PostEntity>> {
  try {
    const stateData = extractFromPageState();
    if (stateData.success) {
      return stateData;
    }
    
    const domData = extractFromDOM();
    if (domData.success) {
      return domData;
    }
    
    return { success: false, error: '无法提取帖子数据' };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

function extractFromPageState(): ExtractResult<PostEntity> {
  try {
    const win = window as any;
    const state = win.__INITIAL_STATE__;
    
    if (!state?.note?.noteDetailMap) {
      return { success: false, error: '页面状态不存在' };
    }
    
    const noteData = Object.values(state.note.noteDetailMap)[0] as any;
    
    if (!noteData?.note) {
      return { success: false, error: '笔记数据不存在' };
    }
    
    const note = noteData.note;
    const user = note.user || {};
    const interactInfo = note.interactInfo || {};
    
    const post: Partial<PostEntity> = {
      platform: 'xhs',
      postId: note.noteId,
      postType: note.type === 'video' ? 'video' : 'image',
      title: note.title || '',
      content: note.desc || '',
      url: `https://www.xiaohongshu.com/explore/${note.noteId}`,
      coverUrl: note.imageList?.[0]?.urlDefault || note.video?.media?.stream?.h264?.[0]?.masterUrl,
      publishTime: note.time ? new Date(note.time).toISOString() : undefined,
      authorId: user.userId,
      authorName: user.nickname,
      authorUrl: user.userId ? `https://www.xiaohongshu.com/user/profile/${user.userId}` : undefined,
      likeCount: interactInfo.likeCount,
      commentCount: interactInfo.commentCount,
      collectCount: interactInfo.collectCount,
      shareCount: interactInfo.shareCount,
      viewCount: note.video?.media?.stream?.h264?.[0]?.videoDuration ? undefined : undefined,
      mediaCount: note.imageList?.length || (note.video ? 1 : 0),
      tags: note.tagList?.map((t: any) => t.name) || [],
      sourcePageUrl: window.location.href,
      sourcePageType: 'post_detail'
    };
    
    return { success: true, data: post as PostEntity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

function extractFromDOM(): ExtractResult<PostEntity> {
  try {
    const postId = extractPostIdFromUrl(window.location.href);
    if (!postId) {
      return { success: false, error: '无法从URL提取帖子ID' };
    }
    
    const titleEl = document.querySelector('#detail-title, .note-content .title');
    const contentEl = document.querySelector('#detail-desc, .note-content .desc');
    const authorEl = document.querySelector('.author-wrapper .username, .user-nickname');
    const likeEl = document.querySelector('[data-v-like] .count, .like-wrapper .count');
    const collectEl = document.querySelector('[data-v-collect] .count, .collect-wrapper .count');
    const commentEl = document.querySelector('[data-v-comment] .count, .chat-wrapper .count');
    
    const coverImg = document.querySelector('.swiper-slide img, .note-image img') as HTMLImageElement;
    
    const post: Partial<PostEntity> = {
      platform: 'xhs',
      postId,
      title: titleEl?.textContent?.trim() || '',
      content: contentEl?.textContent?.trim() || '',
      url: `https://www.xiaohongshu.com/explore/${postId}`,
      coverUrl: coverImg?.src,
      authorName: authorEl?.textContent?.trim(),
      likeCount: parseChineseNumber(likeEl?.textContent || ''),
      collectCount: parseChineseNumber(collectEl?.textContent || ''),
      commentCount: parseChineseNumber(commentEl?.textContent || ''),
      sourcePageUrl: window.location.href,
      sourcePageType: 'post_detail'
    };
    
    return { success: true, data: post as PostEntity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function extractAuthor(): Promise<ExtractResult<AuthorEntity>> {
  try {
    console.log('[智联采集] 开始提取作者数据...');
    
    const stateData = extractAuthorFromPageState();
    if (stateData.success) {
      console.log('[智联采集] 从页面状态提取作者数据成功:', stateData.data);
      return stateData;
    }
    console.log('[智联采集] 从页面状态提取失败:', stateData.error);
    
    const domData = extractAuthorFromDOM();
    if (domData.success) {
      console.log('[智联采集] 从DOM提取作者数据成功:', domData.data);
      return domData;
    }
    console.log('[智联采集] 从DOM提取失败:', domData.error);
    
    return { success: false, error: '无法提取作者数据' };
  } catch (error) {
    console.error('[智联采集] 提取作者数据异常:', error);
    return { success: false, error: (error as Error).message };
  }
}

function extractAuthorFromPageState(): ExtractResult<AuthorEntity> {
  try {
    const win = window as any;
    const state = win.__INITIAL_STATE__;
    
    console.log('[智联采集] __INITIAL_STATE__:', state);
    
    if (!state) {
      return { success: false, error: '__INITIAL_STATE__ 不存在' };
    }
    
    const userInfo = state.user?.userPageInfo || state.userPageInfo;
    console.log('[智联采集] userInfo:', userInfo);
    
    if (!userInfo) {
      return { success: false, error: '用户页面信息不存在' };
    }
    
    const basicInfo = userInfo.basicInfo || {};
    const interactions = userInfo.interactions || [];
    
    console.log('[智联采集] basicInfo:', basicInfo);
    console.log('[智联采集] interactions:', interactions);
    
    const getInteraction = (name: string): number | undefined => {
      const item = interactions.find((i: any) => i.name === name);
      console.log(`[智联采集] 查找互动数据 "${name}":`, item);
      return item?.count;
    };
    
    let fansCount: number | undefined;
    let followCount: number | undefined;
    let likedCount: number | undefined;
    
    fansCount = getInteraction('粉丝') ?? basicInfo.fansCount;
    followCount = getInteraction('关注') ?? basicInfo.followCount;
    likedCount = getInteraction('获赞与收藏') ?? getInteraction('获赞') ?? basicInfo.likedCount;
    
    if (!fansCount && interactions.length > 0) {
      fansCount = interactions[0]?.count;
    }
    if (!followCount && interactions.length > 1) {
      followCount = interactions[1]?.count;
    }
    if (!likedCount && interactions.length > 2) {
      likedCount = interactions[2]?.count;
    }
    
    console.log('[智联采集] 解析后的数据 - 粉丝:', fansCount, '关注:', followCount, '获赞:', likedCount);
    
    const author: Partial<AuthorEntity> = {
      platform: 'xhs',
      authorId: basicInfo.userId,
      name: basicInfo.nickname || '',
      avatar: basicInfo.image,
      profileUrl: `https://www.xiaohongshu.com/user/profile/${basicInfo.userId}`,
      bio: basicInfo.desc,
      fansCount,
      followCount,
      likedCount,
      location: basicInfo.location,
      verified: !!basicInfo.verified,
      verifiedDesc: basicInfo.verifiedInfo?.desc,
      sourcePageUrl: window.location.href
    };
    
    return { success: true, data: author as AuthorEntity };
  } catch (error) {
    console.error('[智联采集] extractAuthorFromPageState 异常:', error);
    return { success: false, error: (error as Error).message };
  }
}

function extractAuthorFromDOM(): ExtractResult<AuthorEntity> {
  try {
    const authorId = extractAuthorIdFromUrl(window.location.href);
    if (!authorId) {
      return { success: false, error: '无法从URL提取作者ID' };
    }
    
    const nameEl = document.querySelector('.user-nickname, .user-name, .nick-name');
    const avatarEl = document.querySelector('.user-avatar img, .avatar img, .user-image img') as HTMLImageElement;
    const bioEl = document.querySelector('.user-desc, .user-bio, .desc');
    
    const statsContainer = document.querySelector('.user-info, .user-side, .stats-container, .data-info');
    console.log('[智联采集] statsContainer:', statsContainer?.innerHTML);
    
    const allCountElements = document.querySelectorAll('[class*="count"], [class*="num"]');
    console.log('[智联采集] 所有计数元素:', allCountElements);
    
    let fansCount: number | undefined;
    let followCount: number | undefined;
    let likedCount: number | undefined;
    let workCount: number | undefined;
    
    const countTexts = Array.from(allCountElements).map(el => ({
      text: el.textContent,
      className: el.className,
      parentText: el.parentElement?.textContent
    }));
    console.log('[智联采集] 计数文本:', countTexts);
    
    const userInfoSection = document.querySelector('.user-info, .user-basic-info, .user-side');
    if (userInfoSection) {
      const allText = userInfoSection.textContent || '';
      console.log('[智联采集] 用户信息区域文本:', allText);
      
      const fansMatch = allText.match(/粉丝[^\d]*(\d+\.?\d*[万千百]?)/);
      const followMatch = allText.match(/关注[^\d]*(\d+\.?\d*[万千百]?)/);
      const likedMatch = allText.match(/获赞[^\d]*(\d+\.?\d*[万千百]?)/);
      
      if (fansMatch) fansCount = parseChineseNumber(fansMatch[1]);
      if (followMatch) followCount = parseChineseNumber(followMatch[1]);
      if (likedMatch) likedCount = parseChineseNumber(likedMatch[1]);
    }
    
    const fansEl = document.querySelector('[data-v-fans] .count, .fans-count, .fans-num');
    const followEl = document.querySelector('[data-v-follow] .count, .follow-count, .follow-num');
    const likedEl = document.querySelector('[data-v-liked] .count, .liked-count, .liked-num');
    const notesEl = document.querySelector('[data-v-notes] .count, .notes-count, .notes-num');
    
    if (!fansCount && fansEl) fansCount = parseChineseNumber(fansEl.textContent || '');
    if (!followCount && followEl) followCount = parseChineseNumber(followEl.textContent || '');
    if (!likedCount && likedEl) likedCount = parseChineseNumber(likedEl.textContent || '');
    if (notesEl) workCount = parseChineseNumber(notesEl.textContent || '');
    
    console.log('[智联采集] DOM解析结果 - 粉丝:', fansCount, '关注:', followCount, '获赞:', likedCount, '作品:', workCount);
    
    const author: Partial<AuthorEntity> = {
      platform: 'xhs',
      authorId,
      name: nameEl?.textContent?.trim() || '',
      avatar: avatarEl?.src,
      profileUrl: `https://www.xiaohongshu.com/user/profile/${authorId}`,
      bio: bioEl?.textContent?.trim(),
      fansCount,
      followCount,
      likedCount,
      workCount,
      sourcePageUrl: window.location.href
    };
    
    return { success: true, data: author as AuthorEntity };
  } catch (error) {
    console.error('[智联采集] extractAuthorFromDOM 异常:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function extractComments(): Promise<ExtractResult<CommentEntity[]>> {
  try {
    const comments = extractCommentsFromDOM();
    if (comments.length > 0) {
      return { success: true, data: comments };
    }
    
    return { success: false, error: '未找到评论数据' };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

function extractCommentsFromDOM(): Partial<CommentEntity>[] {
  const postId = extractPostIdFromUrl(window.location.href);
  const comments: Partial<CommentEntity>[] = [];
  
  const commentEls = document.querySelectorAll('.comment-item, .note-comment .comment');
  
  commentEls.forEach((el, index) => {
    const authorEl = el.querySelector('.user-name, .comment-user-name');
    const contentEl = el.querySelector('.content, .comment-content');
    const likeEl = el.querySelector('.like-count, .comment-like-count');
    const timeEl = el.querySelector('.time, .comment-time');
    
    comments.push({
      platform: 'xhs',
      commentId: `${postId}_comment_${index}`,
      postId,
      authorName: authorEl?.textContent?.trim(),
      content: contentEl?.textContent?.trim(),
      likeCount: parseChineseNumber(likeEl?.textContent || ''),
      publishTime: timeEl?.textContent?.trim(),
      sourcePageUrl: window.location.href
    });
  });
  
  return comments;
}

function parseChineseNumber(text: string): number | undefined {
  if (!text) return undefined;
  
  text = text.trim();
  
  if (text.includes('万')) {
    const num = parseFloat(text.replace('万', ''));
    return num * 10000;
  }
  
  if (text.includes('亿')) {
    const num = parseFloat(text.replace('亿', ''));
    return num * 100000000;
  }
  
  const parsed = parseInt(text.replace(/[^\d]/g, ''), 10);
  return isNaN(parsed) ? undefined : parsed;
}
