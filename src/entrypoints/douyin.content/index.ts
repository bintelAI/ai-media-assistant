import { sendMessage } from '@/shared/utils/messaging';
import type { PageType } from '@/shared/types';
import type { PostEntity, AuthorEntity } from '@/shared/types/entities';

let currentPageType: PageType = 'unknown';
let injectedUI: HTMLElement | null = null;

const collectedPosts: Map<string, Partial<PostEntity>> = new Map();
const collectedAuthors: Map<string, Partial<AuthorEntity>> = new Map();

/** 注入 MAIN world 脚本实现 fetch/XHR 拦截（ISOLATED world 无法拦截页面自身的 fetch）
 *  使用扩展文件 URL 而非内联代码，以绕过抖音 CSP 对内联脚本的限制 */
function injectMainWorldInterceptor() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('douyin/main-interceptor.js');
  script.onload = () => script.remove();
  document.documentElement.appendChild(script);
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
        handleApiData(event.data.url, event.data.data);
      }
    });

    currentPageType = detectDYPage(window.location.href);

    window.addEventListener('load', () => {
      onPageLoaded();
    });

    observePageChanges();
  }
});

// ==================== API 数据拦截处理 ====================

const DATA_API_PATTERNS = [
  '/aweme/v1/web/aweme/detail/',
  '/aweme/v1/web/aweme/post/',
  '/aweme/v1/web/user/profile/',
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

  console.log('[智联AI] 抖音拦截到数据:', url.split('?')[0]);

  if (url.includes('/aweme/detail/')) {
    handleVideoDetailData(data);
  } else if (url.includes('/aweme/post/') || url.includes('/user/posts/') || url.includes('/homepage/')) {
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

function handleVideoDetailData(data: any) {
  // Douyin 详情接口多级路径兼容
  const aweme = data?.aweme_detail || data?.data?.aweme_detail || data?.data;
  if (!aweme?.aweme_id) return;

  const postData = extractPostData(aweme);
  if (postData) {
    collectedPosts.set(aweme.aweme_id, postData);
    console.log(`[智联AI] 抖音缓存视频详情: ${aweme.aweme_id} - ${postData.title}`);
  }
}

function handleListData(data: any, source: string) {
  // 兼容多种响应结构
  const awemeList = data?.aweme_list || data?.data?.aweme_list || data?.data || [];
  if (!Array.isArray(awemeList) || awemeList.length === 0) return;

  let count = 0;
  awemeList.forEach((item: any) => {
    if (!item?.aweme_id) return;
    const postData = extractPostData(item);
    if (postData) {
      collectedPosts.set(item.aweme_id, postData);
      count++;
    }
  });

  if (count > 0) {
    console.log(`[智联AI] 抖音缓存 ${count} 条数据 (${source})`);
    debouncedSavePosts();
  }
}

function handleSearchData(data: any) {
  // 搜索接口可能返回流式数据或多条结果
  const dataRoot = data?.data || data;
  const items = dataRoot?.aweme_list || dataRoot?.items || dataRoot?.results || [];
  if (Array.isArray(items)) {
    let count = 0;
    items.forEach((item: any) => {
      if (!item?.aweme_id) return;
      const postData = extractPostData(item);
      if (postData) {
        collectedPosts.set(item.aweme_id, postData);
        count++;
      }
    });
    if (count > 0) {
      console.log(`[智联AI] 抖音缓存搜索 ${count} 条`);
      debouncedSavePosts();
    }
  }
}

function handleUserData(data: any) {
  const user = data?.user || data?.data?.user;
  if (!user?.uid) return;

  const authorData = extractAuthorData(user);
  if (authorData) {
    collectedAuthors.set(user.uid, authorData);
    sendMessage('cache:author', { author: authorData });
    console.log(`[智联AI] 抖音缓存用户: ${user.uid} - ${authorData.name}`);
  }
}

// ==================== 数据提取 ====================

function extractPostData(aweme: any): Partial<PostEntity> | null {
  if (!aweme?.aweme_id) return null;

  const author = aweme.author || {};
  const statistics = aweme.statistics || {};
  const video = aweme.video || {};

  return {
    platform: 'douyin',
    postId: aweme.aweme_id,
    postType: video ? 'video' : 'image',
    title: aweme.desc || aweme.title || '',
    content: aweme.desc || '',
    url: `https://www.douyin.com/video/${aweme.aweme_id}`,
    coverUrl: video?.cover?.url_list?.[0] || aweme.cover?.url_list?.[0],
    publishTime: aweme.create_time ? new Date(aweme.create_time * 1000).toISOString() : undefined,
    authorId: author.uid,
    authorName: author.nickname || author.name,
    authorUrl: author.uid
      ? `https://www.douyin.com/user/${author.uid}`
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
  if (!user?.uid) return null;

  return {
    platform: 'douyin',
    authorId: user.uid,
    name: user.nickname || user.name || '',
    avatar: user.avatar_medium?.url_list?.[0] || user.avatar_thumb?.url_list?.[0] || user.avatar_url,
    profileUrl: `https://www.douyin.com/user/${user.uid}`,
    bio: user.signature,
    fansCount: user.follower_count,
    followCount: user.following_count,
    likedCount: user.total_favorited,
    workCount: user.aweme_count,
    verified: !!user.verification_type,
    verifiedDesc: user.verification_reason,
    sourcePageUrl: window.location.href
  };
}

// ==================== 防抖保存 ====================

let savePostsTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSavePosts() {
  if (savePostsTimer) clearTimeout(savePostsTimer);
  savePostsTimer = setTimeout(() => {
    if (collectedPosts.size > 0) {
      sendMessage('cache:posts', { posts: Array.from(collectedPosts.values()) });
    }
    savePostsTimer = null;
  }, 1000);
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
  if (url.match(/\/video\/\d+/)) {
    return 'post_detail';
  }

  if (url.includes('/user/')) {
    return 'author_profile';
  }

  if (url.includes('/search/')) {
    return 'search_result';
  }

  if (url === 'https://www.douyin.com' || url.includes('/recommend') || url.includes('/?') ) {
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

      if (newPageType !== currentPageType) {
        currentPageType = newPageType;
        onPageChanged(newPageType);
      }
    }
  });

  observer.observe(document.documentElement || document, { childList: true, subtree: true });
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
      injectListPageUI();
      break;
  }
}

function injectPostPageUI() {
  const selectors = [
    '[data-e2e="video-desc"]',
    '.video-info-detail',
    '#videoDesc',
    '.choose-video-container',
    '.desc-container'
  ];

  let container: Element | null = null;
  for (const sel of selectors) {
    container = document.querySelector(sel);
    if (container) break;
  }

  if (!container) {
    setTimeout(injectPostPageUI, 500);
    return;
  }

  const button = createCollectButton('采集视频', async () => {
    button.textContent = '采集中...';
    (button as HTMLButtonElement).disabled = true;

    const match = window.location.href.match(/\/video\/(\d+)/);
    const postId = match?.[1];
    const cachedPost = postId ? collectedPosts.get(postId) : null;

    if (cachedPost) {
      const response = await sendMessage('collect:post', {
        platform: 'douyin',
        post: cachedPost
      });

      if (response.success) {
        showToast('已保存到本地', 'success');
        button.textContent = '已采集';
      } else {
        showToast('采集失败: ' + response.error, 'error');
        button.textContent = '采集视频';
        (button as HTMLButtonElement).disabled = false;
      }
    } else {
      showToast('数据加载中，请稍后刷新重试', 'info');
      button.textContent = '采集视频';
      (button as HTMLButtonElement).disabled = false;
    }
  });

  container.appendChild(button);
  injectedUI = button;
}

function injectAuthorPageUI() {
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

  const button = createCollectButton('采集作者', async () => {
    button.textContent = '采集中...';
    (button as HTMLButtonElement).disabled = true;

    // 尝试从当前 URL 或缓存中获取作者 ID
    const pathParts = window.location.pathname.split('/');
    const authorIdFromPath = pathParts[pathParts.length - 1];
    const cachedAuthor = authorIdFromPath ? collectedAuthors.get(authorIdFromPath) : null;

    // 兜底：从 DOM 中提取
    const author = cachedAuthor || extractAuthorFromDOM(authorIdFromPath);

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
        (button as HTMLButtonElement).disabled = false;
      }
    } else {
      showToast('数据加载中，请稍后重试', 'info');
      button.textContent = '采集作者';
      (button as HTMLButtonElement).disabled = false;
    }
  });

  container.appendChild(button);
  injectedUI = button;
}

function extractAuthorFromDOM(authorId?: string): Partial<AuthorEntity> | null {
  if (!authorId) return null;

  const nameEl = document.querySelector('[data-e2e="user-name"], .nickname, .user-name');
  const avatarEl = document.querySelector('[data-e2e="user-avatar"] img, .avatar img') as HTMLImageElement;

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
    authorId,
    name: nameEl?.textContent?.trim() || '',
    avatar: avatarEl?.src,
    fansCount: extractNum(statsTexts[0] || ''),
    followCount: extractNum(statsTexts[1] || ''),
    sourcePageUrl: window.location.href
  };
}

function injectListPageUI() {
  const selectors = [
    '[data-e2e="recommend-list-item"]',
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
    setTimeout(injectListPageUI, 500);
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

      const link = video.querySelector('a[href*="/video/"]') as HTMLAnchorElement;
      if (!link) {
        showToast('无法获取视频链接', 'error');
        return;
      }

      const postId = link.href.match(/\/video\/(\d+)/)?.[1];
      if (!postId) {
        showToast('无法获取视频ID', 'error');
        return;
      }

      const cachedPost = collectedPosts.get(postId);
      if (cachedPost) {
        button.innerHTML = '采集中...';
        const response = await sendMessage('collect:post', {
          platform: 'douyin',
          post: cachedPost
        });

        if (response.success) {
          showToast('已保存到本地', 'success');
          button.innerHTML = '已采集';
        } else {
          showToast('采集失败: ' + response.error, 'error');
          button.innerHTML = '采集';
        }
      } else {
        showToast('数据加载中，请稍后重试', 'info');
      }
    });
  });
}

// ==================== UI 工具函数 ====================

function createCollectButton(text: string, onClick: () => void): HTMLElement {
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

  const button = shadow.querySelector('button');
  button?.addEventListener('click', onClick);

  return container;
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
  document.querySelectorAll('.zl-collect-btn').forEach(el => el.remove());
}