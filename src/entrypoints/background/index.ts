import { onMessage, sendMessage } from '@/shared/utils/messaging';
import { ChromeStorage } from '@/shared/utils/storage';
import { initDB } from '@/shared/db';
import { addPost, updatePost } from '@/shared/db/posts';
import { addAuthor, updateAuthor } from '@/shared/db/authors';
import { addComments } from '@/shared/db/comments';
import { addTask, updateTask } from '@/shared/db/tasks';
import { batchCollectManager } from './batchCollectManager';
import type { Message, MessageResponse, BatchCollectStatusResponse, DimensProxyMessage, DimensAuthChangedMessage, DimensOpenAuthorizedPageMessage } from '@/shared/types/messages';
import type { PostEntity, AuthorEntity, CommentEntity } from '@/shared/types/entities';
import { DIMENS_BASE, STORAGE_KEY_AUTH, type DimensAuth } from '@/shared/services/dimens-service';

export default defineBackground(() => {
  console.log('智联AI Background Service Worker started');

  initDB().catch(console.error);

  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(console.error);

  chrome.runtime.onMessage.addListener(
    (message: Message, sender, sendResponse: (response: MessageResponse) => void) => {
      handleMessage(message, sender)
        .then(sendResponse)
        .catch((error) => {
          console.error('Message handler error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }
  );

  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  });

  chrome.downloads.onChanged.addListener((delta) => {
    if (delta.state?.current === 'complete') {
      console.log('Download completed:', delta.id);
    }
  });

  chrome.cookies.onChanged.addListener((changeInfo) => {
    handleDimensCookieChanged(changeInfo).catch((error) => {
      console.error('Dimens cookie change handler error:', error);
    });
  });
});

async function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  switch (message.type) {
    case 'collect:post':
      return handleCollectPost(message.data);
    
    case 'collect:author':
      return handleCollectAuthor(message.data);
    
    case 'collect:comments':
      return handleCollectComments(message.data);
    
    case 'download:media':
      return handleDownloadMedia(message.data);
    
    case 'page:detected':
      return handlePageDetected(message.data, sender);
    
    case 'cache:posts':
      return handleCachePosts(message.data);
    
    case 'cache:author':
      return handleCacheAuthor(message.data);
    
    case 'cache:comments':
      return handleCacheComments(message.data);
    
    case 'batch:collect:start':
      return handleBatchCollectStart(message.data);
    
    case 'batch:collect:control':
      return handleBatchCollectControl(message.data);
    
    case 'batch:collect:status':
      return handleBatchCollectStatus();

    case 'dimens:proxy':
      return handleDimensProxy(message.data);

    case 'dimens:me':
      return handleDimensMe();

    case 'dimens:capture-cookie-token':
      return handleDimensMe();

    case 'dimens:open-login-page':
      return handleDimensOpenLoginPage();

    case 'dimens:open-authorized-page':
      return handleDimensOpenAuthorizedPage(message.data);

    case 'dimens:logout':
      return handleDimensLogout();

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

async function handleCollectPost(data: unknown): Promise<MessageResponse<PostEntity>> {
  try {
    const { platform, post } = data as { platform: string; post: Partial<PostEntity> };
    
    const postId = post.postId;
    let postData = post;
    
    if (postId && cachedPosts.has(postId)) {
      postData = { ...cachedPosts.get(postId), ...post };
      console.log(`[智联AI] 从缓存获取帖子数据: ${postId}`, postData);
    }
    
    const taskId = await addTask({
      taskType: 'collect_post',
      platform: platform as any,
      targetId: postData.postId,
      targetUrl: postData.url,
      title: postData.title || '采集帖子',
      status: 'running'
    });

    try {
      const id = await addPost({
        platform: platform as any,
        postId: postData.postId!,
        postType: postData.postType || 'image',
        title: postData.title || '',
        content: postData.content || '',
        url: postData.url || '',
        shortUrl: postData.shortUrl,
        coverUrl: postData.coverUrl,
        publishTime: postData.publishTime,
        authorId: postData.authorId,
        authorName: postData.authorName,
        authorUrl: postData.authorUrl,
        likeCount: postData.likeCount,
        commentCount: postData.commentCount,
        collectCount: postData.collectCount,
        shareCount: postData.shareCount,
        viewCount: postData.viewCount,
        mediaCount: postData.mediaCount,
        tags: postData.tags,
        sourcePageUrl: postData.sourcePageUrl || '',
        sourcePageType: postData.sourcePageType
      });

      await updateTask(taskId, { status: 'success' });

      return { success: true, data: { id } as PostEntity };
    } catch (error) {
      await updateTask(taskId, { status: 'failed', errorMessage: (error as Error).message });
      throw error;
    }
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

function validateAuthorForSave(author: Partial<AuthorEntity>): { ok: boolean; reason?: string } {
  if (!author.platform) return { ok: false, reason: '缺少平台' };
  if (!author.authorId) return { ok: false, reason: '缺少作者ID' };
  if (!author.name && !author.avatar && !author.profileUrl) {
    return { ok: false, reason: '作者信息为空' };
  }
  return { ok: true };
}

function buildAuthorSavePayload(author: Partial<AuthorEntity>): Omit<AuthorEntity, 'id' | 'collectedAt' | 'updatedAt'> {
  return {
    platform: author.platform!,
    authorId: author.authorId!,
    name: author.name || '',
    avatar: author.avatar,
    profileUrl: author.profileUrl || '',
    bio: author.bio,
    fansCount: author.fansCount,
    followCount: author.followCount,
    likedCount: author.likedCount,
    workCount: author.workCount,
    location: author.location,
    gender: author.gender,
    verified: author.verified,
    verifiedDesc: author.verifiedDesc,
    contactInfo: author.contactInfo,
    sourcePageUrl: author.sourcePageUrl || ''
  };
}

async function handleCollectAuthor(data: unknown): Promise<MessageResponse<AuthorEntity>> {
  try {
    const { platform, author } = data as { platform: string; author: Partial<AuthorEntity> };
    
    const authorId = author.authorId;
    let authorData: Partial<AuthorEntity> = { ...author, platform: (author.platform || platform) as any };
    
    if (authorId && cachedAuthors.has(authorId)) {
      authorData = { ...cachedAuthors.get(authorId), ...author, platform: (author.platform || platform) as any };
      console.log(`[智联AI] 从缓存获取用户数据: ${authorId}`, authorData);
    }

    const validation = validateAuthorForSave(authorData);
    if (!validation.ok) {
      console.warn(`[智联AI] 跳过低质量作者数据: ${authorId || 'unknown'} - ${validation.reason}`, authorData);
      return { success: false, error: validation.reason || '作者数据不完整' };
    }
    
    const taskId = await addTask({
      taskType: 'collect_author',
      platform: platform as any,
      targetId: authorData.authorId,
      targetUrl: authorData.profileUrl,
      title: authorData.name || '采集作者',
      status: 'running'
    });

    try {
      const id = await addAuthor(buildAuthorSavePayload(authorData));

      await updateTask(taskId, { status: 'success' });

      return { success: true, data: { id } as AuthorEntity };
    } catch (error) {
      await updateTask(taskId, { status: 'failed', errorMessage: (error as Error).message });
      throw error;
    }
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function handleCollectComments(data: unknown): Promise<MessageResponse> {
  try {
    const { platform, postId, comments } = data as { 
      platform: string; 
      postId: string;
      comments: Partial<CommentEntity>[]
    };
    
    const taskId = await addTask({
      taskType: 'collect_comments',
      platform: platform as any,
      targetId: postId,
      title: `采集评论 (${comments.length}条)`,
      status: 'running',
      totalCount: comments.length
    });

    try {
      const commentEntities = comments.map(c => ({
        platform: platform as any,
        commentId: c.commentId!,
        postId: postId,
        postTitle: c.postTitle,
        authorId: c.authorId,
        authorName: c.authorName,
        authorAvatar: c.authorAvatar,
        content: c.content || '',
        likeCount: c.likeCount,
        replyCount: c.replyCount,
        publishTime: c.publishTime,
        sourcePageUrl: c.sourcePageUrl || ''
      }));

      await addComments(commentEntities);
      await updateTask(taskId, { status: 'success', successCount: comments.length });

      return { success: true };
    } catch (error) {
      await updateTask(taskId, { status: 'failed', errorMessage: (error as Error).message });
      throw error;
    }
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function handleDownloadMedia(data: unknown): Promise<MessageResponse> {
  try {
    const { url, fileName, postId } = data as { url: string; fileName: string; postId?: string };
    
    const taskId = await addTask({
      taskType: 'download_media',
      targetUrl: url,
      title: fileName,
      status: 'running'
    });

    try {
      const downloadId = await chrome.downloads.download({
        url,
        filename: fileName,
        saveAs: false
      });

      await updateTask(taskId, { status: 'success', meta: { downloadId } });

      return { success: true };
    } catch (error) {
      await updateTask(taskId, { status: 'failed', errorMessage: (error as Error).message });
      throw error;
    }
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function handlePageDetected(
  data: unknown, 
  sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  const { platform, pageType, url } = data as { 
    platform: string; 
    pageType: string; 
    url: string 
  };
  
  console.log(`Page detected: ${platform} - ${pageType} - ${url}`);
  
  return { success: true };
}

const cachedPosts: Map<string, Partial<PostEntity>> = new Map();
const cachedAuthors: Map<string, Partial<AuthorEntity>> = new Map();

// ==================== Dimens Proxy ====================

const DIMENS_ORIGIN = 'https://dimens.bintelai.com';
const DIMENS_LOGIN_URL = `${DIMENS_ORIGIN}/login`;
const DIMENS_COOKIE_TOKEN_NAMES = ['dimens_access_token'];
const DIMENS_AUTH_REQUIRED = 'DIMENS_AUTH_REQUIRED';
const DIMENS_ME_PATH = '/app/user/info/person';
const DIMENS_AUTH_HEADER_RULE_ID = 9001;
type DimensAuthHeadersResult =
  | { ok: true; headers: Record<string, string>; cookieName: string }
  | { ok: false; response: MessageResponse };

function isDimensTokenCookie(cookie: chrome.cookies.Cookie): boolean {
  return cookie.domain.includes('dimens.bintelai.com') &&
    DIMENS_COOKIE_TOKEN_NAMES.includes(cookie.name);
}

function broadcastDimensAuthChanged(data: DimensAuthChangedMessage): void {
  chrome.runtime.sendMessage({ type: 'dimens:auth-changed', data }).catch(() => undefined);
}

async function readDimensCookieToken(): Promise<{ token: string; cookieName: string } | null> {
  for (const name of DIMENS_COOKIE_TOKEN_NAMES) {
    const cookie = await chrome.cookies.get({
      name,
      url: DIMENS_ORIGIN,
    });

    if (cookie?.value) {
      return {
        token: cookie.value,
        cookieName: name,
      };
    }
  }

  return null;
}

function isDimensAuthError(status: number, json: any): boolean {
  return status === 401 ||
    json?.code === 401 ||
    json?.code === DIMENS_AUTH_REQUIRED ||
    json?.message?.includes('未登录') ||
    json?.message?.includes('Unauthorized') ||
    json?.message?.includes('token expired');
}

function normalizeDimensTeamIds(data: any): string[] {
  const rawTeams = [
    ...(Array.isArray(data?.teamIds) ? data.teamIds : []),
    ...(Array.isArray(data?.teamIdList) ? data.teamIdList : []),
    ...(Array.isArray(data?.teams) ? data.teams : []),
    ...(Array.isArray(data?.teamList) ? data.teamList : []),
    ...(Array.isArray(data?.orgs) ? data.orgs : []),
    ...(Array.isArray(data?.orgList) ? data.orgList : []),
    data?.teamId,
    data?.orgId,
    data?.currentTeamId,
    data?.currentOrgId,
  ];

  return Array.from(new Set(rawTeams
    .map((team: any) => {
      if (!team) return '';
      if (typeof team === 'string') return team;
      return team.id || team.teamId || team.orgId || team.code || '';
    })
    .filter(Boolean)));
}

async function buildDimensAuthHeaders(): Promise<DimensAuthHeadersResult> {
  const cookieToken = await readDimensCookieToken();
  if (!cookieToken?.token) {
    return {
      ok: false,
      response: {
        success: false,
        code: DIMENS_AUTH_REQUIRED,
        error: '请先登录维表智联',
      },
    };
  }

  return {
    ok: true,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cookieToken.token}`,
    },
    cookieName: cookieToken.cookieName,
  };
}

async function handleDimensMe(): Promise<MessageResponse<DimensAuth>> {
  try {
    const authHeaders = await buildDimensAuthHeaders();
    if (!authHeaders.ok) return authHeaders.response as MessageResponse<DimensAuth>;

    const response = await fetch(`${DIMENS_BASE}${DIMENS_ME_PATH}`, {
      method: 'GET',
      headers: authHeaders.headers,
    });
    const json = await response.json().catch(() => ({}));

    if (!response.ok || json.code !== 1000) {
      if (isDimensAuthError(response.status, json)) {
        await ChromeStorage.removeItem(STORAGE_KEY_AUTH);
        return {
          success: false,
          code: DIMENS_AUTH_REQUIRED,
          error: json.message || '维表登录已失效，请重新登录',
        };
      }

      return { success: false, error: json.message || `Me 接口检查失败 (HTTP ${response.status})` };
    }

    const data = json.data || {};
    const auth: DimensAuth = {
      source: 'dimens-cookie',
      checkedAt: Date.now(),
      cookieName: authHeaders.cookieName,
      userInfo: data,
      teamIds: normalizeDimensTeamIds(data),
    };

    await ChromeStorage.setItem(STORAGE_KEY_AUTH, auth);
    return { success: true, data: auth };
  } catch (error: any) {
    return { success: false, error: error.message || '维表登录状态检查失败' };
  }
}

async function checkDimensAuthAndBroadcast(reason: DimensAuthChangedMessage['reason'] = 'manual-refresh'): Promise<void> {
  broadcastDimensAuthChanged({ status: 'checking', reason });
  const result = await handleDimensMe();

  if (result.success) {
    broadcastDimensAuthChanged({
      status: 'authenticated',
      userInfo: result.data?.userInfo,
    });
  } else {
    broadcastDimensAuthChanged({
      status: 'unauthenticated',
      error: result.error,
    });
  }
}

async function handleDimensCookieChanged(changeInfo: chrome.cookies.CookieChangeInfo): Promise<void> {
  if (!isDimensTokenCookie(changeInfo.cookie)) return;

  if (changeInfo.removed) {
    await ChromeStorage.removeItem(STORAGE_KEY_AUTH);
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [DIMENS_AUTH_HEADER_RULE_ID],
    }).catch(() => undefined);
    broadcastDimensAuthChanged({ status: 'unauthenticated' });
    return;
  }

  await checkDimensAuthAndBroadcast('cookie-changed');
}

async function handleDimensOpenLoginPage(): Promise<MessageResponse> {
  try {
    broadcastDimensAuthChanged({ status: 'checking', reason: 'login-page-opened' });
    await chrome.tabs.create({ url: DIMENS_LOGIN_URL });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || '打开维表登录页失败' };
  }
}

async function handleDimensOpenAuthorizedPage(data: unknown): Promise<MessageResponse> {
  try {
    const { url } = data as DimensOpenAuthorizedPageMessage;
    const targetUrl = new URL(url);
    if (targetUrl.origin !== DIMENS_ORIGIN) {
      return { success: false, error: '只能打开维表智联页面' };
    }

    const cookieToken = await readDimensCookieToken();
    if (!cookieToken?.token) {
      return { success: false, code: DIMENS_AUTH_REQUIRED, error: '请先登录维表智联' };
    }

    const tab = await chrome.tabs.create({ url: 'about:blank', active: true });
    if (!tab.id) {
      return { success: false, error: '无法创建维表标签页' };
    }

    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [DIMENS_AUTH_HEADER_RULE_ID],
      addRules: [{
        id: DIMENS_AUTH_HEADER_RULE_ID,
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
          requestHeaders: [{
            header: 'authorization',
            operation: chrome.declarativeNetRequest.HeaderOperation.SET,
            value: `Bearer ${cookieToken.token}`,
          }],
        },
        condition: {
          urlFilter: '||dimens.bintelai.com/',
          tabIds: [tab.id],
          resourceTypes: [
            chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
            chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
            chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
          ],
        },
      }],
    });

    await chrome.tabs.update(tab.id, { url: targetUrl.toString() });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || '打开维表页面失败' };
  }
}

async function handleDimensLogout(): Promise<MessageResponse> {
  try {
    for (const name of DIMENS_COOKIE_TOKEN_NAMES) {
      await chrome.cookies.remove({ name, url: DIMENS_ORIGIN }).catch(() => undefined);
    }
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [DIMENS_AUTH_HEADER_RULE_ID],
    }).catch(() => undefined);
    await ChromeStorage.removeItem(STORAGE_KEY_AUTH);
    broadcastDimensAuthChanged({ status: 'unauthenticated', reason: 'logout' });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || '退出登录失败' };
  }
}

async function handleDimensProxy(data: unknown): Promise<MessageResponse> {
  try {
    const { method, path, body, useAuth } = data as DimensProxyMessage;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (useAuth !== false) {
      const authHeaders = await buildDimensAuthHeaders();
      if (!authHeaders.ok) return authHeaders.response;
      Object.assign(headers, authHeaders.headers);
    }

    const url = `${DIMENS_BASE}${path}`;
    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers,
    };

    if (body !== undefined && method.toUpperCase() !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    const json = await response.json().catch(() => ({}));

    // API returns { code, message, data } — success when code === 1000
    if (!response.ok || json.code !== 1000) {
      if (isDimensAuthError(response.status, json)) {
        await ChromeStorage.removeItem(STORAGE_KEY_AUTH);
        broadcastDimensAuthChanged({ status: 'unauthenticated', error: json.message || '维表登录已失效，请重新登录' });
        return {
          success: false,
          code: DIMENS_AUTH_REQUIRED,
          error: json.message || '维表登录已失效，请重新登录',
        };
      }
      return { success: false, error: json.message || `API错误 (code: ${json.code || response.status})` };
    }

    return { success: true, data: json };
  } catch (error: any) {
    return { success: false, error: error.message || 'Dimens请求失败' };
  }
}

async function handleCachePosts(data: unknown): Promise<MessageResponse> {
  try {
    const { posts } = data as { posts: Partial<PostEntity>[] };
    
    let newCount = 0;
    
    for (const post of posts) {
      if (post.postId) {
        cachedPosts.set(post.postId, post);
        
        try {
          await addPost({
            platform: post.platform!,
            postId: post.postId,
            postType: post.postType || 'image',
            title: post.title || '',
            content: post.content || '',
            url: post.url || '',
            shortUrl: post.shortUrl,
            coverUrl: post.coverUrl,
            publishTime: post.publishTime,
            authorId: post.authorId,
            authorName: post.authorName,
            authorUrl: post.authorUrl,
            likeCount: post.likeCount,
            commentCount: post.commentCount,
            collectCount: post.collectCount,
            shareCount: post.shareCount,
            viewCount: post.viewCount,
            mediaCount: post.mediaCount,
            tags: post.tags,
            sourcePageUrl: post.sourcePageUrl || '',
            sourcePageType: post.sourcePageType
          });
          newCount++;
          console.log(`[智联AI] 自动保存帖子: ${post.postId} - ${post.title}`);
        } catch (e: any) {
          if (!e.message?.includes('already exists')) {
            console.warn(`[智联AI] 保存帖子失败: ${post.postId}`, e.message);
          }
        }
      }
    }
    
    console.log(`[智联AI] 已缓存 ${posts.length} 条帖子，新增 ${newCount} 条，总计 ${cachedPosts.size} 条`);
    
    return { success: true, data: { count: cachedPosts.size, newCount } };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function handleCacheAuthor(data: unknown): Promise<MessageResponse> {
  try {
    const { author } = data as { author: Partial<AuthorEntity> };
    
    if (author.authorId) {
      cachedAuthors.set(author.authorId, author);
      const validation = validateAuthorForSave(author);
      if (!validation.ok) {
        console.warn(`[智联AI] 仅缓存低质量用户，暂不落库: ${author.authorId} - ${validation.reason}`, author);
        return { success: true, data: { skipped: true, reason: validation.reason } };
      }
      
      try {
        await addAuthor(buildAuthorSavePayload(author));
        console.log(`[智联AI] 自动保存用户: ${author.authorId} - ${author.name}`, author);
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.warn(`[智联AI] 保存用户失败: ${author.authorId}`, e.message);
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

const cachedComments: Map<string, Partial<CommentEntity>> = new Map();

/**
 * 处理评论缓存消息
 * @param data 评论数据
 * @returns 消息响应
 */
async function handleCacheComments(data: unknown): Promise<MessageResponse> {
  try {
    const { comments } = data as { comments: Partial<CommentEntity>[] };
    
    let newCount = 0;
    
    for (const comment of comments) {
      if (comment.commentId) {
        cachedComments.set(comment.commentId, comment);
        
        try {
          await addComments([{
            platform: comment.platform!,
            commentId: comment.commentId,
            postId: comment.postId!,
            postTitle: comment.postTitle,
            authorId: comment.authorId,
            authorName: comment.authorName,
            authorAvatar: comment.authorAvatar,
            content: comment.content || '',
            likeCount: comment.likeCount,
            replyCount: comment.replyCount,
            publishTime: comment.publishTime,
            sourcePageUrl: comment.sourcePageUrl || ''
          }]);
          newCount++;
          console.log(`[智联AI] 自动保存评论: ${comment.commentId} - ${comment.authorName}`);
        } catch (e: any) {
          if (!e.message?.includes('already exists')) {
            console.warn(`[智联AI] 保存评论失败: ${comment.commentId}`, e.message);
          }
        }
      }
    }
    
    console.log(`[智联AI] 已缓存 ${comments.length} 条评论，新增 ${newCount} 条，总计 ${cachedComments.size} 条`);
    
    return { success: true, data: { count: cachedComments.size, newCount } };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * 处理批量采集开始消息
 * @param data 批量采集开始数据
 * @returns 消息响应
 */
async function handleBatchCollectStart(data: unknown): Promise<MessageResponse> {
  try {
    const { urls } = data as { urls: string[] };
    
    if (!urls || urls.length === 0) {
      return { success: false, error: 'URL列表为空' };
    }

    const result = await batchCollectManager.startBatchCollect(urls);
    
    return { success: result.accepted > 0, data: result, error: result.accepted > 0 ? undefined : '没有可采集的URL' };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * 处理批量采集控制消息
 * @param data 控制消息数据
 * @returns 消息响应
 */
async function handleBatchCollectControl(data: unknown): Promise<MessageResponse> {
  try {
    const { action } = data as { action: 'pause' | 'resume' | 'cancel' };
    
    switch (action) {
      case 'pause':
        batchCollectManager.pause();
        break;
      case 'resume':
        batchCollectManager.resume();
        break;
      case 'cancel':
        batchCollectManager.cancel();
        break;
      default:
        return { success: false, error: `未知的控制操作: ${action}` };
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * 处理批量采集状态查询
 * @returns 批量采集状态响应
 */
async function handleBatchCollectStatus(): Promise<MessageResponse<BatchCollectStatusResponse>> {
  const status: BatchCollectStatusResponse = {
    isRunning: batchCollectManager.getIsRunning(),
    isPaused: batchCollectManager.getIsPaused(),
    progress: batchCollectManager.getProgress()
  };
  
  return { success: true, data: status };
}
