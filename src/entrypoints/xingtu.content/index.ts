import { sendMessage } from '@/shared/utils/messaging';
import type { PageType } from '@/shared/types';
import type { PostEntity, AuthorEntity } from '@/shared/types/entities';

let currentPageType: PageType = 'unknown';
let injectedUI: HTMLElement | null = null;

const collectedPosts: Map<string, Partial<PostEntity>> = new Map();
const collectedAuthors: Map<string, Partial<AuthorEntity>> = new Map();

export default defineContentScript({
  matches: ['*://star.toutiao.com/*'],
  runAt: 'document_start',
  
  main() {
    console.log('[智联AI] 星图 Content Script 已加载');
    
    setupXhrInterceptor();
    
    currentPageType = detectXingtuPage(window.location.href);
    
    window.addEventListener('load', () => {
      onPageLoaded();
    });
    
    observePageChanges();
  }
});

function setupXhrInterceptor() {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
    (this as any)._url = typeof url === 'string' ? url : url.toString();
    (this as any)._method = method;
    return originalOpen.apply(this, [method, url, ...args] as any);
  };
  
  XMLHttpRequest.prototype.send = function(body?: any) {
    const url = (this as any)._url;
    
    if (url && isDataApiUrl(url)) {
      const xhr = this;
      const originalOnReadyStateChange = xhr.onreadystatechange;
      
      xhr.onreadystatechange = function(ev: any) {
        if (xhr.readyState === 4 && xhr.status === 200) {
          try {
            const contentType = xhr.getResponseHeader('content-type') || '';
            if (contentType.includes('application/json')) {
              const data = JSON.parse(xhr.responseText);
              handleApiData(url, data);
            }
          } catch (e) {
            console.warn('[智联AI] 解析响应失败:', e);
          }
        }
        if (originalOnReadyStateChange) {
          originalOnReadyStateChange.call(xhr, ev);
        }
      };
    }
    
    return originalSend.apply(this, [body] as any);
  };
  
  console.log('[智联AI] 星图 XHR 拦截器已设置');
}

function isDataApiUrl(url: string): boolean {
  const dataApis = [
    '/api/author/',
    '/api/video/',
    '/api/task/',
    '/daren/',
    '/video/',
  ];
  
  return dataApis.some(api => url.includes(api));
}

function handleApiData(url: string, data: any) {
  if (!data) return;
  
  console.log('[智联AI] 星图拦截到数据:', url.split('?')[0]);
  
  if (url.includes('/author/') || url.includes('/daren/')) {
    handleAuthorData(data);
  } else if (url.includes('/video/')) {
    handleVideoData(data);
  }
}

function handleAuthorData(data: any) {
  const author = data?.data?.author || data?.author || data?.data;
  if (!author?.id && !author?.author_id) return;
  
  const authorId = author.id || author.author_id;
  const authorData = extractAuthorData(author);
  if (authorData) {
    collectedAuthors.set(authorId, authorData);
    console.log(`[智联AI] 星图缓存达人: ${authorId} - ${authorData.name}`);
  }
}

function handleVideoData(data: any) {
  const videos = data?.data?.list || data?.data || [data?.video].filter(Boolean);
  
  videos.forEach((video: any) => {
    if (!video?.id && !video?.video_id) return;
    
    const videoId = video.id || video.video_id;
    const postData = extractPostData(video);
    if (postData) {
      collectedPosts.set(videoId, postData);
    }
  });
  
  if (collectedPosts.size > 0) {
    console.log(`[智联AI] 星图缓存视频数据`);
    debouncedSavePosts();
  }
}

function extractPostData(video: any): Partial<PostEntity> | null {
  if (!video?.id && !video?.video_id) return null;
  
  const author = video.author || {};
  
  return {
    platform: 'xingtu',
    postId: video.id || video.video_id,
    postType: 'video',
    title: video.title || video.desc || '',
    content: video.desc || video.description || '',
    url: video.share_url || `https://star.toutiao.com/video/${video.id || video.video_id}`,
    coverUrl: video.cover?.url || video.cover_url,
    publishTime: video.create_time ? new Date(video.create_time * 1000).toISOString() : undefined,
    authorId: author.id || author.author_id,
    authorName: author.nickname || author.name,
    authorUrl: author.id ? `https://star.toutiao.com/daren/${author.id}` : undefined,
    likeCount: video.like_count || video.digg_count,
    commentCount: video.comment_count,
    collectCount: video.collect_count,
    shareCount: video.share_count,
    viewCount: video.play_count || video.view_count,
    sourcePageUrl: window.location.href,
    sourcePageType: 'feed_list'
  };
}

function extractAuthorData(author: any): Partial<AuthorEntity> | null {
  if (!author?.id && !author?.author_id) return null;
  
  return {
    platform: 'xingtu',
    authorId: author.id || author.author_id,
    name: author.nickname || author.name || '',
    avatar: author.avatar?.url || author.avatar_url || author.head_url,
    profileUrl: `https://star.toutiao.com/daren/${author.id || author.author_id}`,
    bio: author.signature || author.description,
    fansCount: author.fans_count || author.follower_count,
    followCount: author.follow_count || author.following_count,
    likedCount: author.total_like_count || author.liked_count,
    workCount: author.video_count || author.work_count,
    verified: !!author.verify_status,
    verifiedDesc: author.verify_info,
    sourcePageUrl: window.location.href
  };
}

let savePostsTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedSavePosts() {
  if (savePostsTimer) {
    clearTimeout(savePostsTimer);
  }
  savePostsTimer = setTimeout(() => {
    if (collectedPosts.size > 0) {
      sendMessage('cache:posts', { posts: Array.from(collectedPosts.values()) });
    }
    savePostsTimer = null;
  }, 1000);
}

function onPageLoaded() {
  console.log('[智联AI] 星图页面加载完成:', currentPageType);
  
  setTimeout(() => {
    injectUIByPageType(currentPageType);
  }, 1000);
}

function detectXingtuPage(url: string): PageType {
  if (url.includes('/daren/')) {
    return 'author_profile';
  }
  
  if (url.includes('/video/')) {
    return 'post_detail';
  }
  
  if (url.includes('/search/')) {
    return 'search_result';
  }
  
  return 'feed_list';
}

function observePageChanges() {
  let lastUrl = window.location.href;
  
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      const newPageType = detectXingtuPage(window.location.href);
      
      if (newPageType !== currentPageType) {
        currentPageType = newPageType;
        onPageChanged(newPageType);
      }
    }
  });
  
  observer.observe(document.documentElement || document, { childList: true, subtree: true });
}

function onPageChanged(pageType: PageType) {
  console.log('[智联AI] 星图页面切换:', pageType);
  
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
    default:
      injectListPageUI();
  }
}

function injectPostPageUI() {
  const container = document.querySelector('.video-info, .video-detail, [class*="video-info"]');
  if (!container) {
    setTimeout(injectPostPageUI, 500);
    return;
  }
  
  const button = createCollectButton('采集视频', async () => {
    button.textContent = '采集中...';
    button.disabled = true;
    
    const match = window.location.href.match(/\/video\/([\w]+)/);
    const postId = match?.[1];
    const cachedPost = postId ? collectedPosts.get(postId) : null;
    
    if (cachedPost) {
      const response = await sendMessage('collect:post', {
        platform: 'xingtu',
        post: cachedPost
      });
      
      if (response.success) {
        showToast('已保存到本地', 'success');
        button.textContent = '已采集';
      } else {
        showToast('采集失败: ' + response.error, 'error');
        button.textContent = '采集视频';
        button.disabled = false;
      }
    } else {
      showToast('数据加载中，请稍后重试', 'info');
      button.textContent = '采集视频';
      button.disabled = false;
    }
  });
  
  container.appendChild(button);
  injectedUI = button;
}

function injectAuthorPageUI() {
  const container = document.querySelector('.author-info, .user-info, [class*="author-info"]');
  if (!container) {
    setTimeout(injectAuthorPageUI, 500);
    return;
  }
  
  const button = createCollectButton('采集达人', async () => {
    button.textContent = '采集中...';
    button.disabled = true;
    
    const match = window.location.href.match(/\/daren\/([\w]+)/);
    const authorId = match?.[1];
    const cachedAuthor = authorId ? collectedAuthors.get(authorId) : null;
    
    if (cachedAuthor) {
      const response = await sendMessage('collect:author', {
        platform: 'xingtu',
        author: cachedAuthor
      });
      
      if (response.success) {
        showToast('已保存到本地', 'success');
        button.textContent = '已采集';
      } else {
        showToast('采集失败: ' + response.error, 'error');
        button.textContent = '采集达人';
        button.disabled = false;
      }
    } else {
      showToast('数据加载中，请稍后重试', 'info');
      button.textContent = '采集达人';
      button.disabled = false;
    }
  });
  
  container.appendChild(button);
  injectedUI = button;
}

function injectListPageUI() {
  const items = document.querySelectorAll('[class*="video-item"], [class*="author-item"], .list-item');
  
  items.forEach((item) => {
    if (item.querySelector('.zl-collect-btn')) return;
    
    const button = document.createElement('button');
    button.className = 'zl-collect-btn';
    button.innerHTML = '采集';
    button.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px 8px;
      background: rgba(33, 150, 243, 0.9);
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 10;
    `;
    
    item.style.position = 'relative';
    item.appendChild(button);
    
    item.addEventListener('mouseenter', () => {
      button.style.opacity = '1';
    });
    
    item.addEventListener('mouseleave', () => {
      button.style.opacity = '0';
    });
    
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      button.innerHTML = '采集中...';
      
      const link = item.querySelector('a[href*="/daren/"], a[href*="/video/"]') as HTMLAnchorElement;
      if (!link) {
        showToast('无法获取链接', 'error');
        button.innerHTML = '采集';
        return;
      }
      
      if (link.href.includes('/daren/')) {
        const authorId = link.href.match(/\/daren\/([\w]+)/)?.[1];
        const cachedAuthor = authorId ? collectedAuthors.get(authorId) : null;
        if (cachedAuthor) {
          const response = await sendMessage('collect:author', {
            platform: 'xingtu',
            author: cachedAuthor
          });
          if (response.success) {
            showToast('已保存到本地', 'success');
            button.innerHTML = '已采集';
          } else {
            showToast('采集失败', 'error');
            button.innerHTML = '采集';
          }
        }
      } else {
        const postId = link.href.match(/\/video\/([\w]+)/)?.[1];
        const cachedPost = postId ? collectedPosts.get(postId) : null;
        if (cachedPost) {
          const response = await sendMessage('collect:post', {
            platform: 'xingtu',
            post: cachedPost
          });
          if (response.success) {
            showToast('已保存到本地', 'success');
            button.innerHTML = '已采集';
          } else {
            showToast('采集失败', 'error');
            button.innerHTML = '采集';
          }
        }
      }
    });
  });
}

function createCollectButton(text: string, onClick: () => void): HTMLElement {
  const container = document.createElement('div');
  const shadow = container.attachShadow({ mode: 'open' });
  
  shadow.innerHTML = `
    <style>
      button {
        padding: 8px 16px;
        background: #2196f3;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
        margin-left: 12px;
      }
      button:hover {
        background: #1976d2;
      }
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    </style>
    <button>${text}</button>
  `;
  
  const button = shadow.querySelector('button');
  button?.addEventListener('click', onClick);
  
  return container;
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const existing = document.querySelector('.zl-toast');
  if (existing) {
    existing.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = 'zl-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    background: ${
      type === 'success' ? '#22c55e' :
      type === 'error' ? '#ef4444' : '#3b82f6'
    };
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
