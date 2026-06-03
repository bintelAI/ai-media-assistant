import { sendMessage } from '@/shared/utils/messaging';
import type { PageType } from '@/shared/types';
import type { PostEntity, AuthorEntity } from '@/shared/types/entities';

let currentPageType: PageType = 'unknown';
let injectedUI: HTMLElement | null = null;
let ensureUITimer: ReturnType<typeof setTimeout> | null = null;
let currentVisiblePostId: string | null = null;
let activePostWatcherTimer: ReturnType<typeof setInterval> | null = null;

const PAGE_UI_CLASS = 'zl-page-collect-ui';
const PAGE_UI_SELECTOR = `.${PAGE_UI_CLASS}`;
const DOUYIN_VIDEO_CONTROLS_SELECTOR = 'xg-controls:not(.control_autohide) xg-right-grid';

const collectedPosts: Map<string, Partial<PostEntity>> = new Map();
const collectedAuthors: Map<string, Partial<AuthorEntity>> = new Map();

interface DouyinAuthorPathInfo {
  id: string;
  isSecUid: boolean;
}

function normalizeDouyinUrl(url: string): string {
  return String(url || '').replace(/^https:\/\/www-[^.]+\.douyin\.com/, 'https://www.douyin.com');
}

function getPageUISelector(pageType: 'post_detail' | 'author_profile') {
  return `${PAGE_UI_SELECTOR}[data-zl-page-type="${pageType}"]`;
}

function getDouyinPostIdFromUrl(url = window.location.href): string | null {
  const modalMatch = url.match(/[?&]modal_id=(\d+)/);
  const pathMatch = url.match(/\/(?:video|note)\/(\d+)/);
  return modalMatch?.[1] || pathMatch?.[1] || null;
}

function getDouyinPathPostId(url = window.location.href): string | null {
  return url.match(/\/(?:video|note)\/(\d+)/)?.[1] || null;
}

function getDouyinModalPostId(url = window.location.href): string | null {
  return url.match(/[?&]modal_id=(\d+)/)?.[1] || null;
}

function escapeAttributeValue(value: string): string {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function getDouyinPostIdFromElement(element?: Element | null): string | null {
  if (!element) return null;

  const current = element as HTMLElement;
  const selfId = current.getAttribute?.('data-e2e-vid');
  if (selfId) return selfId;

  const closest = current.closest?.('[data-e2e-vid]') as HTMLElement | null;
  const closestId = closest?.getAttribute('data-e2e-vid');
  if (closestId) return closestId;

  const child = current.querySelector?.('[data-e2e-vid]') as HTMLElement | null;
  const childId = child?.getAttribute('data-e2e-vid');
  if (childId) return childId;

  const link = current.querySelector?.('a[href*="/video/"], a[href*="/note/"], a[href*="modal_id="]') as HTMLAnchorElement | null;
  return link?.href ? getDouyinPostIdFromUrl(link.href) : null;
}

function getDouyinActiveDomPostId(): string | null {
  const activeVideo = document.querySelector<HTMLElement>('div[data-e2e="feed-active-video"]');
  const activeVideoId = activeVideo?.getAttribute('data-e2e-vid');
  if (activeVideoId) return activeVideoId;

  const activeControl = document.querySelector(`${DOUYIN_VIDEO_CONTROLS_SELECTOR}`);
  const controlPostId = getDouyinPostIdFromElement(activeControl);
  if (controlPostId) return controlPostId;

  const visibleVideo = Array.from(document.querySelectorAll<HTMLElement>('div[data-e2e-vid]'))
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 240 && rect.height > 180 && rect.bottom > 0 && rect.top < window.innerHeight;
    })
    .sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      const aArea = Math.max(0, Math.min(aRect.bottom, window.innerHeight) - Math.max(aRect.top, 0)) * aRect.width;
      const bArea = Math.max(0, Math.min(bRect.bottom, window.innerHeight) - Math.max(bRect.top, 0)) * bRect.width;
      return bArea - aArea;
    })[0];

  return visibleVideo?.getAttribute('data-e2e-vid') || null;
}

function getDouyinActivePostId(): string | null {
  // 抖音精选/推荐/详情上下刷时，URL 的 modal_id 或 pathname 可能滞后于当前可见视频。
  // 这里优先取官方 active DOM 标记，避免按钮采到上一条作品。
  const domPostId = getDouyinActiveDomPostId();
  if (domPostId) return domPostId;

  const pathPostId = getDouyinPathPostId();
  if (pathPostId) return pathPostId;

  return getDouyinModalPostId();
}

function findDouyinPostActionAnchor(postId = getDouyinActivePostId()): Element | null {
  if (postId) {
    const safePostId = escapeAttributeValue(postId);
    const inCurrentVideo = document.querySelector(`div[data-e2e-vid="${safePostId}"] ${DOUYIN_VIDEO_CONTROLS_SELECTOR}`);
    if (inCurrentVideo) return inCurrentVideo;
  }

  const activeControls = document.querySelector(`div[data-e2e="feed-active-video"] ${DOUYIN_VIDEO_CONTROLS_SELECTOR}`);
  if (activeControls) return activeControls;

  const detailControls = document.querySelector(
    `div[data-e2e="video-detail"] ${DOUYIN_VIDEO_CONTROLS_SELECTOR}, div[data-e2e="note-detail"] ${DOUYIN_VIDEO_CONTROLS_SELECTOR}`
  );
  if (detailControls) return detailControls;

  return null;
}

function findDouyinAwemeInfoInReactProps(root: Element | null): any {
  if (!root) return null;

  const holder = root as unknown as Record<string, any>;
  const propsKey = Object.keys(holder).find((key) => key.startsWith('__reactProps$'));
  const children = propsKey ? holder[propsKey]?.children : null;
  if (!Array.isArray(children)) return null;

  for (const child of children) {
    const awemeInfo = child?.props?.awemeInfo;
    if (awemeInfo?.awemeId || awemeInfo?.aweme_id) {
      return {
        ...awemeInfo,
        aweme_id: awemeInfo.aweme_id || awemeInfo.awemeId
      };
    }
  }

  return null;
}

function getDouyinAwemeInfoFromDOM(postId = getDouyinActivePostId()): any {
  let root: Element | null = null;

  if (postId) {
    root = document.querySelector(`div[data-e2e-vid="${escapeAttributeValue(postId)}"]`);
  }

  if (!root) {
    const pathMatch = window.location.pathname.match(/^\/(video|note)\/\d+/);
    if (pathMatch) {
      root = document.querySelector(`[data-e2e="${pathMatch[1]}-detail"]`)?.parentElement || null;
    }
  }

  return findDouyinAwemeInfoInReactProps(root);
}

function cacheDouyinPostFromDOM(postId = getDouyinActivePostId()): Partial<PostEntity> | null {
  const aweme = getDouyinAwemeInfoFromDOM(postId);
  const postData = extractPostData(aweme);
  if (postData?.postId) {
    cacheDouyinPost(postData.postId, postData, aweme);
    debouncedSavePosts();
    return postData;
  }

  return null;
}

async function resolveDouyinPost(postId = getDouyinActivePostId()): Promise<Partial<PostEntity> | null> {
  if (!postId) return null;

  const cachedPost = collectedPosts.get(postId);
  if (cachedPost) return cachedPost;

  const domPost = cacheDouyinPostFromDOM(postId);
  if (domPost) return domPost;

  return fetchDouyinPostViaPageApi(postId);
}

/** 注入 MAIN world 脚本实现 fetch/XHR 拦截（ISOLATED world 无法拦截页面自身的 fetch）
 *  使用扩展文件 URL 而非内联代码，以绕过抖音 CSP 对内联脚本的限制 */
function injectMainWorldInterceptor() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('douyin/main-interceptor.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement || document).appendChild(script);
}

export default defineContentScript({
  matches: ['*://www.douyin.com/*'],
  runAt: 'document_start',

  main() {
    console.log('[智联AI] 抖音 Content Script 已加载');

    // 注入 MAIN world 拦截脚本（拦截页面自身的 fetch/XHR）
    injectMainWorldInterceptor();

    // 监听 MAIN world 发来的拦截数据
    window.addEventListener('message', (event: MessageEvent) => {
      if (event.data?.type === 'zl_dy_api_response') {
        handleApiData(normalizeDouyinUrl(event.data.url), event.data.data);
      }
    });

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'douyin:api:ping') {
        const requestId = Date.now().toString() + Math.random().toString(36).slice(2, 9);
        let isResponded = false;

        const cleanup = () => {
          window.removeEventListener('message', handlePingResponse);
          clearTimeout(timeoutId);
        };

        const timeoutId = setTimeout(() => {
          if (isResponded) return;
          isResponded = true;
          cleanup();
          sendResponse({
            success: false,
            error: '抖音页面请求函数未就绪，请刷新抖音页面后重试',
            data: {
              ok: false,
              href: window.location.href,
              readyState: document.readyState,
              hasBridge: false,
              action: 'refresh_douyin'
            }
          });
        }, 5000);

        const handlePingResponse = (event: MessageEvent) => {
          if (
            event.data?.type === 'zl_dy_api_ping_response' &&
            event.data?.requestId === requestId &&
            event.data?.source === 'main'
          ) {
            if (isResponded) return;
            isResponded = true;
            cleanup();
            sendResponse({
              success: true,
              data: {
                ok: Boolean(event.data.hasBridge),
                href: event.data.href,
                readyState: event.data.readyState,
                hasBridge: Boolean(event.data.hasBridge),
                hasGet: Boolean(event.data.hasGet),
                hasPost: Boolean(event.data.hasPost),
                action: event.data.hasBridge ? undefined : 'retry_later',
                error: event.data.hasBridge ? undefined : '抖音页面请求函数未就绪，请等待页面加载完成后重试'
              }
            });
          }
        };

        window.addEventListener('message', handlePingResponse);
        window.postMessage({
          type: 'zl_dy_api_ping',
          requestId,
          source: 'isolated'
        }, '*');

        return true;
      }

      if (message.type !== 'douyin:api:call') {
        return;
      }

      const requestId = Date.now().toString() + Math.random().toString(36).slice(2, 9);
      let isResponded = false;

      const cleanup = () => {
        window.removeEventListener('message', handleResponse);
        window.removeEventListener('message', handleError);
        clearTimeout(timeoutId);
      };

      const timeoutId = setTimeout(() => {
        if (isResponded) return;
        isResponded = true;
        cleanup();
        sendResponse({ success: false, error: '抖音 API 请求超时，请刷新抖音页面后重试' });
      }, 30000);

      const handleResponse = (event: MessageEvent) => {
        if (
          event.data?.type === 'zl_dy_api_call_response' &&
          event.data?.requestId === requestId &&
          event.data?.source === 'main'
        ) {
          if (isResponded) return;
          isResponded = true;
          cleanup();
          sendResponse({ success: true, data: event.data.response });
        }
      };

      const handleError = (event: MessageEvent) => {
        if (
          event.data?.type === 'zl_dy_api_call_error' &&
          event.data?.requestId === requestId &&
          event.data?.source === 'main'
        ) {
          if (isResponded) return;
          isResponded = true;
          cleanup();
          sendResponse({ success: false, error: event.data.error });
        }
      };

      window.addEventListener('message', handleResponse);
      window.addEventListener('message', handleError);
      window.postMessage({
        type: 'zl_dy_api_request',
        requestId,
        source: 'isolated',
        method: message.method || 'GET',
        path: message.path,
        params: message.params || {}
      }, '*');

      return true;
    });

    currentPageType = detectDYPage(window.location.href);

    window.addEventListener('load', () => {
      onPageLoaded();
    });

    observePageChanges();
    startActivePostWatcher();
  }
});

// ==================== API 数据拦截处理 ====================

const DATA_API_PATTERNS = [
  '/aweme/v1/web/aweme/detail/',
  '/aweme/v1/web/multi/aweme/detail/',
  '/aweme/v1/web/aweme/post/',
  '/aweme/v2/web/module/feed/',
  '/aweme/v1/web/user/profile/',
  '/aweme/v1/web/query/user/',
  '/aweme/v1/web/search/item/',
  '/aweme/v1/web/search/single/',
  '/aweme/v1/web/general/search/single/',
  '/aweme/v1/web/feed/',
  '/aweme/v1/web/homepage/',
  '/v1/web/user/posts/',
  '/v1/web/familiar/feed/',
  '/live/promotions/page/'
];

function isDataApiUrl(url: string): boolean {
  return DATA_API_PATTERNS.some(api => url.includes(api));
}

function handleApiData(url: string, data: any) {
  if (!data) return;
  url = normalizeDouyinUrl(url);

  console.log('[智联AI] 抖音拦截到数据:', url.split('?')[0]);

  if (url.includes('/aweme/detail/') || url.includes('/multi/aweme/detail/')) {
    handleVideoDetailData(data);
  } else if (url.includes('/module/feed/')) {
    handleListData(data, 'module_feed');
  } else if (url.includes('/homepage/')) {
    handleHomepageData(data);
  } else if (url.includes('/aweme/post/') || url.includes('/user/posts/')) {
    handleListData(data, 'post');
  } else if (url.includes('/user/profile/')) {
    handleUserData(data);
  } else if (url.includes('/search/')) {
    handleSearchData(data);
  } else if (url.includes('/feed/') || url.includes('/familiar/feed/')) {
    handleListData(data, 'feed');
  } else if (url.includes('/live/promotions/page/')) {
    handleListData(data, 'live');
  }
}

function handleHomepageData(data: any) {
  const root = data?.data || data;
  const user = root?.user || root?.user_info || root?.author;
  if (user) {
    handleUserData({ user });
  }
  handleListData(data, 'homepage');
}

function handleVideoDetailData(data: any) {
  // Douyin 详情接口多级路径兼容
  const awemeList = extractAwemeList(data);
  const aweme = awemeList[0] || data?.aweme_detail || data?.data?.aweme_detail || data?.data;
  if (!aweme?.aweme_id) return;

  const postData = extractPostData(aweme);
  if (postData) {
    cacheDouyinPost(aweme.aweme_id, postData, aweme);
    console.log(`[智联AI] 抖音缓存视频详情: ${aweme.aweme_id} - ${postData.title}`);
    scheduleEnsureUI();
  }
  if (aweme.author) {
    const authorData = extractAuthorData(aweme.author);
    if (authorData) {
      cacheAuthorAliases(aweme.author, authorData);
      sendMessage('cache:author', { author: authorData });
    }
  }
}

function unwrapDouyinAweme(item: any): any {
  return item?.aweme_info ||
    item?.aweme ||
    item?.data?.aweme_info ||
    item?.data?.aweme ||
    item?.data?.aweme_detail ||
    item?.aweme_detail ||
    item?.aweme_list?.[0] ||
    item?.data?.aweme_list?.[0] ||
    item?.aweme_mix_info?.mix_items?.[0] ||
    item;
}

function extractAwemeList(data: any): any[] {
  const roots = [
    data,
    data?.data,
    data?.data?.data,
    data?.aweme_detail,
    data?.data?.aweme_detail
  ];

  const items: any[] = [];
  for (const root of roots) {
    if (!root) continue;
    if (Array.isArray(root)) {
      items.push(...root);
      continue;
    }
    const list = root.aweme_list || root.awemeList || root.items || root.list || root.data;
    if (Array.isArray(list)) {
      items.push(...list);
    } else if (root.aweme_id || root.aweme_info || root.aweme || root.aweme_detail) {
      items.push(root);
    }
  }

  return items.map(unwrapDouyinAweme).filter((aweme) => aweme?.aweme_id);
}

function cacheDouyinPost(postId: string, postData: Partial<PostEntity>, aweme?: any) {
  const id = String(postId || postData.postId || '').trim();
  if (!id) return;

  const normalizedPost = { ...postData, postId: id };
  collectedPosts.set(id, normalizedPost);

  const aliases = [
    aweme?.aweme_id,
    aweme?.group_id,
    aweme?.item_id,
    aweme?.awemeId,
    postData.postId
  ].map((value) => String(value || '').trim()).filter(Boolean);

  aliases.forEach((alias) => collectedPosts.set(alias, normalizedPost));
}

function handleListData(data: any, source: string) {
  // 兼容多种响应结构
  const awemeList = extractAwemeList(data);
  if (!Array.isArray(awemeList) || awemeList.length === 0) return;

  let count = 0;
  let authorCount = 0;
  awemeList.forEach((item: any) => {
    const aweme = unwrapDouyinAweme(item);
    if (!aweme?.aweme_id) return;
    const postData = extractPostData(aweme);
    if (postData) {
      cacheDouyinPost(aweme.aweme_id, postData, aweme);
      count++;
    }
    if (aweme.author) {
      const authorData = extractAuthorData(aweme.author);
      if (authorData) {
        cacheAuthorAliases(aweme.author, authorData);
        sendMessage('cache:author', { author: authorData });
        authorCount++;
      }
    }
  });

  if (count > 0) {
    console.log(`[智联AI] 抖音缓存 ${count} 条数据 (${source})`);
    debouncedSavePosts();
    scheduleEnsureUI();
  }
  if (authorCount > 0) {
    console.log(`[智联AI] 抖音同步缓存 ${authorCount} 个作者 (${source})`);
  }
}

function handleSearchData(data: any) {
  // 搜索接口可能返回流式数据或多条结果
  const dataRoot = data?.data || data;
  const items = Array.isArray(dataRoot)
    ? dataRoot
    : dataRoot?.aweme_list || dataRoot?.items || dataRoot?.results || [];
  if (Array.isArray(items)) {
    let count = 0;
    let authorCount = 0;
    items.forEach((item: any) => {
      const aweme = unwrapDouyinAweme(item);
      if (!aweme?.aweme_id) return;
      const postData = extractPostData(aweme);
      if (postData) {
        cacheDouyinPost(aweme.aweme_id, postData, aweme);
        count++;
      }
      if (aweme.author) {
        const authorData = extractAuthorData(aweme.author);
        if (authorData) {
          cacheAuthorAliases(aweme.author, authorData);
          sendMessage('cache:author', { author: authorData });
          authorCount++;
        }
      }
    });
    if (count > 0) {
      console.log(`[智联AI] 抖音缓存搜索 ${count} 条`);
      debouncedSavePosts();
      scheduleEnsureUI();
    }
    if (authorCount > 0) {
      console.log(`[智联AI] 抖音缓存搜索作者 ${authorCount} 个`);
    }
  }
}

function handleUserData(data: any) {
  const user = data?.user || data?.data?.user || data?.user_info || data?.data?.user_info;
  const authorId = getAuthorPrimaryId(user);
  if (!authorId) return;

  const authorData = extractAuthorData(user);
  if (authorData) {
    cacheAuthorAliases(user, authorData);
    sendMessage('cache:author', { author: authorData });
    console.log(`[智联AI] 抖音缓存用户: ${authorId} - ${authorData.name}`);
  }
}

// ==================== 数据提取 ====================

function getAuthorPrimaryId(user: any): string {
  return String(user?.uid || user?.id || user?.user_id || user?.sec_uid || user?.secUid || '').trim();
}

function getAuthorAliasIds(user: any): string[] {
  const ids = [
    user?.uid,
    user?.id,
    user?.user_id,
    user?.sec_uid,
    user?.secUid,
    user?.unique_id,
    user?.uniqueId,
    user?.short_id,
    user?.shortId,
    user?.web_rid,
    user?.webRid,
  ];
  return Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
}

function cacheAuthorAliases(user: any, authorData: Partial<AuthorEntity>) {
  const aliases = getAuthorAliasIds(user);
  for (const alias of aliases) {
    collectedAuthors.set(alias, authorData);
  }
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

function extractPostData(aweme: any): Partial<PostEntity> | null {
  if (!aweme?.aweme_id) return null;

  const author = aweme.author || {};
  const statistics = aweme.statistics || {};
  const video = aweme.video || {};
  const hasVideo = !!(
    video?.play_addr ||
    video?.download_addr ||
    video?.bit_rate?.length ||
    video?.cover?.url_list?.length
  );
  const hasImages = Array.isArray(aweme.images) && aweme.images.length > 0;
  const authorId = getAuthorPrimaryId(author);
  const profilePathId = getDouyinProfilePathId(author);

  return {
    platform: 'douyin',
    postId: aweme.aweme_id,
    postType: hasVideo ? 'video' : hasImages ? 'image' : 'video',
    title: aweme.desc || aweme.title || '',
    content: aweme.desc || '',
    url: `https://www.douyin.com/${hasImages && !hasVideo ? 'note' : 'video'}/${aweme.aweme_id}`,
    coverUrl: video?.cover?.url_list?.[0] || aweme.cover?.url_list?.[0] || aweme.images?.[0]?.url_list?.[0],
    publishTime: aweme.create_time ? new Date(aweme.create_time * 1000).toISOString() : undefined,
    authorId,
    authorName: author.nickname || author.name,
    authorUrl: profilePathId
      ? `https://www.douyin.com/user/${profilePathId}`
      : undefined,
    likeCount: statistics.digg_count ?? statistics.like_count,
    commentCount: statistics.comment_count,
    collectCount: statistics.collect_count,
    shareCount: statistics.share_count,
    viewCount: statistics.play_count,
    mediaCount: aweme.images?.length || 1,
    tags: aweme.text_extra?.map((t: any) => t.hashtag_name).filter(Boolean) || [],
    sourcePageUrl: window.location.href,
    sourcePageType: currentPageType
  };
}

function extractAuthorData(user: any): Partial<AuthorEntity> | null {
  const authorId = getAuthorPrimaryId(user);
  if (!authorId) return null;
  const profilePathId = getDouyinProfilePathId(user);

  return {
    platform: 'douyin',
    authorId,
    name: user.nickname || user.name || '',
    avatar: user.avatar_medium?.url_list?.[0] || user.avatar_thumb?.url_list?.[0] || user.avatar_larger?.url_list?.[0] || user.avatar_url,
    profileUrl: `https://www.douyin.com/user/${profilePathId}`,
    bio: user.signature,
    fansCount: user.follower_count ?? user.mplatform_followers_count,
    followCount: user.following_count,
    likedCount: user.total_favorited,
    workCount: user.aweme_count,
    verified: !!user.verification_type,
    verifiedDesc: user.verification_reason,
    sourcePageUrl: window.location.href
  };
}

// ==================== 防抖保存 ====================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureCurrentDouyinAuthor(authorPath?: DouyinAuthorPathInfo | null): Promise<Partial<AuthorEntity> | null> {
  if (!authorPath?.id) return null;

  const cachedAuthor = collectedAuthors.get(authorPath.id);
  if (cachedAuthor) return cachedAuthor;

  await sleep(1000);
  const delayedCachedAuthor = collectedAuthors.get(authorPath.id);
  if (delayedCachedAuthor) return delayedCachedAuthor;

  return extractAuthorFromDOM(authorPath);
}

async function callDouyinPageApi<T>(
  path: string,
  params: Record<string, unknown>,
  method = 'GET',
  timeout = 30000
): Promise<T | null> {
  const requestId = Date.now().toString() + Math.random().toString(36).slice(2, 9);

  return new Promise((resolve) => {
    let isSettled = false;
    const cleanup = () => {
      window.removeEventListener('message', handleResponse);
      window.removeEventListener('message', handleError);
      clearTimeout(timer);
    };
    const settle = (value: T | null) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      resolve(value);
    };

    const timer = setTimeout(() => settle(null), timeout);

    const handleResponse = (event: MessageEvent) => {
      if (
        event.data?.type === 'zl_dy_api_call_response' &&
        event.data?.requestId === requestId &&
        event.data?.source === 'main'
      ) {
        settle(event.data.response as T);
      }
    };

    const handleError = (event: MessageEvent) => {
      if (
        event.data?.type === 'zl_dy_api_call_error' &&
        event.data?.requestId === requestId &&
        event.data?.source === 'main'
      ) {
        console.warn('[智联AI] 抖音页面 API 调用失败:', event.data.error);
        settle(null);
      }
    };

    window.addEventListener('message', handleResponse);
    window.addEventListener('message', handleError);
    window.postMessage({
      type: 'zl_dy_api_request',
      requestId,
      source: 'isolated',
      method,
      path,
      params
    }, '*');
  });
}

async function fetchDouyinPostViaPageApi(postId: string): Promise<Partial<PostEntity> | null> {
  const result = await callDouyinPageApi<any>('/aweme/v1/web/aweme/detail/', { aweme_id: postId });
  const aweme = extractAwemeList(result)[0] ||
    result?.aweme_detail ||
    result?.data?.aweme_detail ||
    result?.aweme ||
    result?.data?.aweme;

  const postData = extractPostData(aweme);
  if (postData?.postId) {
    cacheDouyinPost(postData.postId, postData, aweme);
    debouncedSavePosts();
    return postData;
  }

  return null;
}

async function collectDouyinPostById(postId?: string | null): Promise<{ success: boolean; error?: string }> {
  const targetPostId = postId || getDouyinActivePostId();
  const post = targetPostId ? await resolveDouyinPost(targetPostId) : findCurrentDouyinPost();

  if (!post) {
    return { success: false, error: '当前作品数据加载中，请先上下滑动一次或稍后重试' };
  }

  const response = await sendMessage('collect:post', {
    platform: 'douyin',
    post
  });

  return response.success
    ? { success: true }
    : { success: false, error: response.error || '采集失败' };
}

let savePostsTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSavePosts() {
  if (savePostsTimer) clearTimeout(savePostsTimer);
  savePostsTimer = setTimeout(() => {
    if (collectedPosts.size > 0) {
      sendMessage('cache:posts', { posts: getUniqueCachedDouyinPosts() });
    }
    savePostsTimer = null;
  }, 1000);
}

function getUniqueCachedDouyinPosts(): Partial<PostEntity>[] {
  const unique = new Map<string, Partial<PostEntity>>();
  for (const post of collectedPosts.values()) {
    const postId = String(post?.postId || '').trim();
    if (postId) unique.set(postId, post);
  }
  return Array.from(unique.values());
}

// ==================== 页面检测与 UI 注入 ====================

function onPageLoaded() {
  console.log('[智联AI] 抖音页面加载完成:', currentPageType);

  // 延迟等待页面渲染完成
  setTimeout(() => {
    injectUIByPageType(currentPageType);
  }, 1000);
}

function detectDYPage(url: string): PageType {
  const normalizedUrl = normalizeDouyinUrl(url);

  if (normalizedUrl.match(/\/(?:video|note)\/\d+/) || normalizedUrl.match(/[?&]modal_id=\d+/)) {
    return 'post_detail';
  }

  if (normalizedUrl.includes('/user/')) {
    return 'author_profile';
  }

  if (normalizedUrl.includes('/search/')) {
    return 'search_result';
  }

  const path = new URL(normalizedUrl, 'https://www.douyin.com').pathname;
  if (
    path === '/' ||
    path === '/jingxuan' ||
    path === '/recommend' ||
    normalizedUrl.includes('/recommend') ||
    normalizedUrl.includes('/?')
  ) {
    return 'feed_list';
  }

  return 'unknown';
}

function observePageChanges() {
  let lastUrl = window.location.href;

  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      const newPageType = detectDYPage(window.location.href);

      currentPageType = newPageType;
      onPageChanged(newPageType);
      return;
    }

    scheduleEnsureUI();
  });

  observer.observe(document.documentElement || document, { childList: true, subtree: true });
}

function startActivePostWatcher() {
  if (activePostWatcherTimer) return;

  activePostWatcherTimer = setInterval(() => {
    if (!['post_detail', 'feed_list', 'search_result'].includes(currentPageType)) return;

    const activePostId = getDouyinActivePostId();
    const actionAnchor = findDouyinPostActionAnchor(activePostId);
    const currentPostUI = document.querySelector(getPageUISelector('post_detail'));

    if (actionAnchor && currentPostUI && !actionAnchor.contains(currentPostUI)) {
      currentVisiblePostId = activePostId || currentVisiblePostId;
      if (activePostId) cacheDouyinPostFromDOM(activePostId);
      removeInjectedUI();
      injectPostActionUI(actionAnchor, activePostId);
      return;
    }

    if (!activePostId || activePostId === currentVisiblePostId) return;

    currentVisiblePostId = activePostId;
    cacheDouyinPostFromDOM(activePostId);

    if (currentPageType === 'post_detail' || findDouyinPostActionAnchor(activePostId)) {
      removeInjectedUI();
      injectUIByPageType(currentPageType);
    }
  }, 1000);
}

function scheduleEnsureUI() {
  if (ensureUITimer) return;

  ensureUITimer = setTimeout(() => {
    ensureUITimer = null;
    if (shouldEnsurePageUI()) {
      injectUIByPageType(currentPageType);
    }
  }, 300);
}

function shouldEnsurePageUI(): boolean {
  if (!['post_detail', 'author_profile', 'feed_list', 'search_result'].includes(currentPageType)) {
    return false;
  }

  if (currentPageType === 'feed_list' || currentPageType === 'search_result') {
    return !document.querySelector(getPageUISelector('post_detail')) || hasDouyinListCards();
  }

  if (currentPageType !== 'post_detail' && currentPageType !== 'author_profile') {
    return false;
  }

  return !document.querySelector(getPageUISelector(currentPageType));
}

function onPageChanged(pageType: PageType) {
  console.log('[智联AI] 抖音页面切换:', pageType);

  removeInjectedUI();

  setTimeout(() => {
    injectUIByPageType(pageType);
  }, 1000);
}

function injectUIByPageType(pageType: PageType) {
  switch (pageType) {
    case 'post_detail':
      injectPostPageUI();
      break;
    case 'author_profile':
      injectAuthorPageUI();
      break;
    case 'feed_list':
    case 'search_result':
      injectCurrentPostFloatingUI();
      injectListPageUI();
      break;
  }
}

function hasDouyinListCards(): boolean {
  return document.querySelectorAll(
    '[data-e2e="recommend-list-item"], [data-e2e="feed-active-video"], [data-e2e-vid], .video-card, .aweme-card, .xg_player, [class*="video-feed"] > div'
  ).length > 0;
}

function injectPostPageUI() {
  if (currentPageType !== 'post_detail') return;

  const activePostId = getDouyinActivePostId();
  const actionAnchor = findDouyinPostActionAnchor(activePostId);
  const existingUI = document.querySelector(getPageUISelector('post_detail'));

  if (existingUI) {
    if (actionAnchor && !actionAnchor.contains(existingUI)) {
      removeInjectedUI();
      injectPostActionUI(actionAnchor, activePostId);
    }
    return;
  }

  if (actionAnchor) {
    injectPostActionUI(actionAnchor, activePostId);
    return;
  }

  const selectors = [
    '[data-e2e="video-desc"]',
    '[data-e2e="detail-desc"]',
    '[data-e2e="note-desc"]',
    '.video-info-detail',
    '.note-info-detail',
    '#videoDesc',
    '.choose-video-container',
    '.desc-container',
    '[class*="VideoInfo"]',
    '[class*="NoteInfo"]',
    '[class*="Detail"] [class*="desc"]'
  ];

  let container: Element | null = null;
  for (const sel of selectors) {
    container = document.querySelector(sel);
    if (container) break;
  }

  if (!container) {
    container = findDouyinDetailContainer();
  }

  if (!container) {
    if (activePostId) {
      injectCurrentPostFallbackUI();
      return;
    }

    setTimeout(injectPostPageUI, 500);
    return;
  }

  const defaultText = window.location.pathname.includes('/note/') ? '采集图文' : '采集视频';
  const { container: buttonContainer, button } = createCollectButton(defaultText, async () => {
    button.textContent = '采集中...';
    button.disabled = true;

    const result = await collectDouyinPostById(getDouyinActivePostId());

    if (result.success) {
      showToast('已保存到本地', 'success');
      button.textContent = '已采集';
    } else {
      showToast(result.error || '采集失败', 'error');
      button.textContent = defaultText;
      button.disabled = false;
    }
  });

  buttonContainer.classList.add(PAGE_UI_CLASS);
  buttonContainer.dataset.zlPageType = 'post_detail';
  container.appendChild(buttonContainer);
  injectedUI = buttonContainer;
}

function injectPostActionUI(anchor: Element, postId?: string | null) {
  const defaultText = window.location.pathname.includes('/note/') ? '采集图文' : '采集视频';
  const { container: buttonContainer, button } = createCollectButton(defaultText, async () => {
    button.textContent = '采集中...';
    button.disabled = true;

    const activePostId = getDouyinActivePostId() || postId;
    const result = await collectDouyinPostById(activePostId);

    if (result.success) {
      showToast('已保存到本地', 'success');
      button.textContent = '已采集';
    } else {
      showToast(result.error || '采集失败', 'error');
      button.textContent = defaultText;
      button.disabled = false;
    }
  });

  buttonContainer.classList.add(PAGE_UI_CLASS);
  buttonContainer.dataset.zlPageType = 'post_detail';
  buttonContainer.style.cssText = 'z-index: 99; display: inline-flex; align-items: center;';
  anchor.prepend(buttonContainer);
  injectedUI = buttonContainer;
}

function findDouyinDetailContainer(): Element | null {
  const postId = getDouyinPostIdFromUrl();
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('article, section, main, div'));

  const scored = candidates
    .map((el) => {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length < 20) return null;

      let score = 0;
      if (postId && text.includes(postId)) score += 3;
      if (text.includes('发布时间')) score += 4;
      if (text.includes('相关推荐')) score += 2;
      if (text.includes('评论')) score += 1;
      if (text.includes('关注')) score += 1;
      if (text.includes('粉丝')) score += 1;

      const rect = el.getBoundingClientRect();
      if (rect.width < 120 || rect.height < 40) score -= 2;
      if (rect.width > window.innerWidth * 0.95 && rect.height > window.innerHeight * 0.9) score -= 3;

      return score > 0 ? { el, score, area: rect.width * rect.height } : null;
    })
    .filter((item): item is { el: HTMLElement; score: number; area: number } => item !== null)
    .sort((a, b) => b.score - a.score || a.area - b.area);

  return scored[0]?.el || null;
}

function injectAuthorPageUI() {
  if (currentPageType !== 'author_profile' || document.querySelector(getPageUISelector('author_profile'))) return;

  const selectors = [
    '[data-e2e="user-info"]',
    '.user-info',
    '#user-info',
    '.profile-header',
    '.author-header'
  ];

  let container: Element | null = null;
  for (const sel of selectors) {
    container = document.querySelector(sel);
    if (container) break;
  }

  if (!container) {
    setTimeout(injectAuthorPageUI, 500);
    return;
  }

  const { container: buttonContainer, button } = createCollectButton('采集作者', async () => {
    button.textContent = '采集中...';
    button.disabled = true;

    // 尝试从当前 URL 或缓存中获取作者 ID
    const authorPath = getDouyinAuthorPathInfo();
    const author = await ensureCurrentDouyinAuthor(authorPath);

    if (author) {
      const response = await sendMessage('collect:author', {
        platform: 'douyin',
        author
      });

      if (response.success) {
        showToast('已保存到本地', 'success');
        button.textContent = '已采集';
      } else {
        showToast('采集失败: ' + response.error, 'error');
        button.textContent = '采集作者';
        button.disabled = false;
      }
    } else {
      showToast('数据加载中，请稍后重试', 'info');
      button.textContent = '采集作者';
      button.disabled = false;
    }
  });

  buttonContainer.classList.add(PAGE_UI_CLASS);
  buttonContainer.dataset.zlPageType = 'author_profile';
  container.appendChild(buttonContainer);
  injectedUI = buttonContainer;
}

function getDouyinAuthorPathInfo(url = window.location.href): DouyinAuthorPathInfo | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/user\/([^/?#]+)/);
    const authorId = match?.[1]?.trim();
    if (!authorId) return null;
    const decoded = decodeURIComponent(authorId);
    return { id: decoded, isSecUid: decoded.startsWith('MS4w') };
  } catch {
    return null;
  }
}

function extractAuthorFromDOM(authorPath?: DouyinAuthorPathInfo | null): Partial<AuthorEntity> | null {
  if (!authorPath?.id) return null;

  const nameEl = document.querySelector('[data-e2e="user-name"], .nickname, .user-name');
  const avatarEl = document.querySelector('[data-e2e="user-avatar"] img, .avatar img') as HTMLImageElement;
  const name = nameEl?.textContent?.trim() || '';
  const avatar = avatarEl?.src || '';

  if (!name && !avatar) {
    return null;
  }

  const statsEls = document.querySelectorAll('[data-e2e="user-stats"] span, .stats span, .count');
  const statsTexts = Array.from(statsEls).map(el => el.textContent || '');

  const extractNum = (text: string): number | undefined => {
    const num = parseFloat(text.replace(/[^0-9.]/g, ''));
    if (text.includes('万')) return num * 10000;
    if (text.includes('亿')) return num * 100000000;
    return isNaN(num) ? undefined : num;
  };

  return {
    platform: 'douyin',
    authorId: authorPath.id,
    name,
    avatar,
    profileUrl: `https://www.douyin.com/user/${authorPath.id}`,
    fansCount: extractNum(statsTexts[0] || ''),
    followCount: extractNum(statsTexts[1] || ''),
    sourcePageUrl: window.location.href
  };
}

function injectListPageUI() {
  const selectors = [
    '[data-e2e="recommend-list-item"]',
    '[data-e2e-vid]',
    '.video-card',
    '.aweme-card',
    '.xg_player',
    '[class*="video-feed"] > div'
  ];

  let videoContainer: NodeListOf<Element> | null = null;
  for (const sel of selectors) {
    const items = document.querySelectorAll(sel);
    if (items.length > 0) {
      videoContainer = items;
      break;
    }
  }

  if (!videoContainer || videoContainer.length === 0) {
    return;
  }

  videoContainer.forEach((video) => {
    if (video.querySelector('.zl-collect-btn')) return;

    const button = document.createElement('button');
    button.className = 'zl-collect-btn';
    button.innerHTML = '采集';
    button.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px 8px;
      background: rgba(254, 44, 85, 0.9);
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 10;
    `;

    (video as HTMLElement).style.position = 'relative';
    video.appendChild(button);

    video.addEventListener('mouseenter', () => { button.style.opacity = '1'; });
    video.addEventListener('mouseleave', () => { button.style.opacity = '0'; });

    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const postId = getDouyinPostIdFromElement(video);
      if (!postId) {
        showToast('无法获取作品ID', 'error');
        return;
      }

      button.innerHTML = '采集中...';
      const result = await collectDouyinPostById(postId);
      if (result.success) {
        showToast('已保存到本地', 'success');
        button.innerHTML = '已采集';
      } else {
        showToast(result.error || '采集失败', 'error');
        button.innerHTML = '采集';
      }
    });
  });
}

function injectCurrentPostFloatingUI() {
  if (!['feed_list', 'search_result'].includes(currentPageType)) return;
  injectCurrentPostFallbackUI();
}

function injectCurrentPostFallbackUI() {
  if (document.querySelector(getPageUISelector('post_detail'))) return;

  const activeAnchor = findDouyinPostActionAnchor();
  if (activeAnchor) {
    injectPostActionUI(activeAnchor, getDouyinActivePostId());
    return;
  }

  const { container, button } = createCollectButton('采集当前作品', async () => {
    button.textContent = '采集中...';
    button.disabled = true;

    const postId = getDouyinActivePostId() || currentVisiblePostId;
    const result = await collectDouyinPostById(postId);

    if (result.success) {
      showToast('已保存到本地', 'success');
      button.textContent = '已采集';
      return;
    }

    showToast(result.error || '采集失败', 'error');
    button.textContent = '采集当前作品';
    button.disabled = false;
  });

  container.classList.add(PAGE_UI_CLASS);
  container.dataset.zlPageType = 'post_detail';
  container.style.cssText = `
    position: fixed;
    right: 24px;
    bottom: 96px;
    z-index: 2147483647;
  `;
  document.documentElement.appendChild(container);
  injectedUI = container;
}

function findCurrentDouyinPost(): Partial<PostEntity> | null {
  const activePostId = getDouyinActivePostId();
  if (activePostId) {
    currentVisiblePostId = activePostId;
    const fromActive = collectedPosts.get(activePostId);
    if (fromActive) return fromActive;
  }

  const visiblePostId = getVisibleDouyinPostId();
  if (visiblePostId) {
    currentVisiblePostId = visiblePostId;
    const fromVisible = collectedPosts.get(visiblePostId);
    if (fromVisible) return fromVisible;
  }

  if (currentVisiblePostId) {
    const fromLastVisible = collectedPosts.get(currentVisiblePostId);
    if (fromLastVisible) return fromLastVisible;
  }

  return getMostRecentDouyinPost();
}

function getVisibleDouyinPostId(): string | null {
  const visibleText = Array.from(document.querySelectorAll<HTMLElement>('article, section, main, div'))
    .map((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight || rect.width < 200 || rect.height < 80) {
        return '';
      }
      return (el.textContent || '').replace(/\s+/g, ' ').trim();
    })
    .filter(Boolean)
    .join(' ')
    .slice(0, 5000);

  if (!visibleText) return null;

  let best: { id: string; score: number } | null = null;
  for (const [id, post] of collectedPosts.entries()) {
    if (!post?.title && !post?.content) continue;
    const title = (post.title || post.content || '').slice(0, 32);
    if (!title || title.length < 4) continue;

    const score = visibleText.includes(title)
      ? title.length
      : longestCommonSubstringLength(visibleText, title);

    if (score >= 6 && (!best || score > best.score)) {
      best = { id, score };
    }
  }

  return best?.id || null;
}

function longestCommonSubstringLength(a: string, b: string): number {
  const left = a.slice(0, 5000);
  const right = b.slice(0, 80);
  const dp = new Array(right.length + 1).fill(0);
  let max = 0;

  for (let i = 1; i <= left.length; i++) {
    for (let j = right.length; j >= 1; j--) {
      if (left[i - 1] === right[j - 1]) {
        dp[j] = dp[j - 1] + 1;
        if (dp[j] > max) max = dp[j];
      } else {
        dp[j] = 0;
      }
    }
  }

  return max;
}

function getMostRecentDouyinPost(): Partial<PostEntity> | null {
  const posts = Array.from(collectedPosts.values()).filter((post) => post?.postId);
  return posts.length > 0 ? posts[posts.length - 1] : null;
}

// ==================== UI 工具函数 ====================

function createCollectButton(
  text: string,
  onClick: () => void
): { container: HTMLElement; button: HTMLButtonElement } {
  const container = document.createElement('div');
  const shadow = container.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      button {
        padding: 8px 16px;
        background: #fe2c55;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
        margin-left: 12px;
      }
      button:hover { background: #e0284d; }
      button:disabled { opacity: 0.6; cursor: not-allowed; }
    </style>
    <button>${text}</button>
  `;

  const button = shadow.querySelector('button') as HTMLButtonElement;
  button.addEventListener('click', onClick);

  return { container, button };
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const existing = document.querySelector('.zl-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'zl-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    border-radius: 8px;
    font-size: 14px;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

function removeInjectedUI() {
  if (injectedUI) {
    injectedUI.remove();
    injectedUI = null;
  }
  document.querySelectorAll(PAGE_UI_SELECTOR).forEach(el => el.remove());
  document.querySelectorAll('.zl-collect-btn').forEach(el => el.remove());
}
