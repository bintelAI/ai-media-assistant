import { sendMessage } from '@/shared/utils/messaging';
import type { PageType } from '@/shared/types';
import type { PostEntity, AuthorEntity } from '@/shared/types/entities';

let currentPageType: PageType = 'unknown';
let injectedUI: HTMLElement | null = null;

const collectedPosts: Map<string, Partial<PostEntity>> = new Map();
const collectedAuthors: Map<string, Partial<AuthorEntity>> = new Map();

export default defineContentScript({
  matches: ['*://www.kuaishou.com/*'],
  runAt: 'document_start',
  
  main() {
    console.log('[智联采集] 快手 Content Script 已加载');
    
    setupXhrInterceptor();
    
    currentPageType = detectKSPage(window.location.href);
    
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
            console.warn('[智联采集] 解析响应失败:', e);
          }
        }
        if (originalOnReadyStateChange) {
          originalOnReadyStateChange.call(xhr, ev);
        }
      };
    }
    
    return originalSend.apply(this, [body] as any);
  };
  
  console.log('[智联采集] 快手 XHR 拦截器已设置');
}

function isDataApiUrl(url: string): boolean {
  const dataApis = [
    '/rest/n/feed/hot',
    '/rest/n/feed/newest',
    '/rest/n/feed/detail',
    '/rest/n/user/profile/',
    '/rest/n/photo/info/',
    '/rest/n/search/video/',
  ];
  
  return dataApis.some(api => url.includes(api));
}

function handleApiData(url: string, data: any) {
  if (!data) return;
  
  console.log('[智联采集] 快手拦截到数据:', url.split('?')[0]);
  
  if (url.includes('/photo/info/') || url.includes('/feed/detail')) {
    handleVideoDetailData(data);
  } else if (url.includes('/user/profile/')) {
    handleUserData(data);
  } else if (url.includes('/feed/hot') || url.includes('/feed/newest') || url.includes('/search/video')) {
    handleFeedData(data);
  }
}

function handleVideoDetailData(data: any) {
  const photo = data?.photo || data?.data?.photo;
  if (!photo?.id) return;
  
  const postData = extractPostData(photo);
  if (postData) {
    collectedPosts.set(photo.id, postData);
    console.log(`[智联采集] 快手缓存视频: ${photo.id}`);
  }
}

function handleUserData(data: any) {
  const user = data?.user || data?.data?.user;
  if (!user?.id) return;
  
  const authorData = extractAuthorData(user);
  if (authorData) {
    collectedAuthors.set(user.id, authorData);
    console.log(`[智联采集] 快手缓存用户: ${user.id} - ${authorData.name}`);
  }
}

function handleFeedData(data: any) {
  const items = data?.feeds || data?.data?.feeds || data?.list || [];
  let count = 0;
  
  items.forEach((item: any) => {
    const photo = item.photo || item;
    if (!photo?.id) return;
    
    const postData = extractPostData(photo);
    if (postData) {
      collectedPosts.set(photo.id, postData);
      count++;
    }
  });
  
  if (count > 0) {
    console.log(`[智联采集] 快手缓存 ${count} 条视频数据`);
    debouncedSavePosts();
  }
}

function extractPostData(photo: any): Partial<PostEntity> | null {
  if (!photo?.id) return null;
  
  const author = photo.author || {};
  
  return {
    platform: 'kuaishou',
    postId: photo.id,
    postType: photo.mainMvUrls ? 'video' : 'image',
    title: photo.caption || photo.title || '',
    content: photo.caption || '',
    url: `https://www.kuaishou.com/short-video/${photo.id}`,
    coverUrl: photo.coverUrls?.[0]?.url || photo.coverUrl,
    publishTime: photo.timestamp ? new Date(photo.timestamp).toISOString() : undefined,
    authorId: author.id,
    authorName: author.name || author.nickname,
    authorUrl: author.id ? `https://www.kuaishou.com/profile/${author.id}` : undefined,
    likeCount: photo.likeCount,
    commentCount: photo.commentCount,
    collectCount: photo.collectCount,
    shareCount: photo.shareCount,
    viewCount: photo.viewCount || photo.playCount,
    mediaCount: 1,
    tags: photo.tags?.map((t: any) => t.name || t).filter(Boolean) || [],
    sourcePageUrl: window.location.href,
    sourcePageType: 'feed_list'
  };
}

function extractAuthorData(user: any): Partial<AuthorEntity> | null {
  if (!user?.id) return null;
  
  return {
    platform: 'kuaishou',
    authorId: user.id,
    name: user.name || user.nickname || '',
    avatar: user.headerUrl || user.avatar,
    profileUrl: `https://www.kuaishou.com/profile/${user.id}`,
    bio: user.description || user.bio,
    fansCount: user.fan,
    followCount: user.follow,
    likedCount: user.liked,
    workCount: user.photoNum || user.workCount,
    verified: !!user.verified,
    verifiedDesc: user.verifiedDesc,
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
  console.log('[智联采集] 快手页面加载完成:', currentPageType);
  
  setTimeout(() => {
    injectUIByPageType(currentPageType);
  }, 1000);
}

function detectKSPage(url: string): PageType {
  if (url.match(/\/short-video\/[\w]+/)) {
    return 'post_detail';
  }
  
  if (url.includes('/profile/') || url.match(/\/profile\/[\w]+/)) {
    return 'author_profile';
  }
  
  if (url.includes('/search/')) {
    return 'search_result';
  }
  
  if (url === 'https://www.kuaishou.com' || url.includes('/brilliant')) {
    return 'feed_list';
  }
  
  return 'unknown';
}

function observePageChanges() {
  let lastUrl = window.location.href;
  
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      const newPageType = detectKSPage(window.location.href);
      
      if (newPageType !== currentPageType) {
        currentPageType = newPageType;
        onPageChanged(newPageType);
      }
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}

function onPageChanged(pageType: PageType) {
  console.log('[智联采集] 快手页面切换:', pageType);
  
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
  const container = document.querySelector('.video-info-wrap, .video-detail-content, #video-info');
  if (!container) {
    setTimeout(injectPostPageUI, 500);
    return;
  }
  
  const button = createCollectButton('采集视频', async () => {
    button.textContent = '采集中...';
    button.disabled = true;
    
    const match = window.location.href.match(/\/short-video\/([\w]+)/);
    const postId = match?.[1];
    const cachedPost = postId ? collectedPosts.get(postId) : null;
    
    if (cachedPost) {
      const response = await sendMessage('collect:post', {
        platform: 'kuaishou',
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
  const container = document.querySelector('.user-info-wrap, .profile-header, #user-info');
  if (!container) {
    setTimeout(injectAuthorPageUI, 500);
    return;
  }
  
  const button = createCollectButton('采集作者', async () => {
    button.textContent = '采集中...';
    button.disabled = true;
    
    const match = window.location.href.match(/\/profile\/([\w]+)/);
    const authorId = match?.[1];
    const cachedAuthor = authorId ? collectedAuthors.get(authorId) : null;
    
    if (cachedAuthor) {
      const response = await sendMessage('collect:author', {
        platform: 'kuaishou',
        author: cachedAuthor
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
  
  container.appendChild(button);
  injectedUI = button;
}

function injectListPageUI() {
  const videos = document.querySelectorAll('.video-item, .feed-item, .item-card');
  
  videos.forEach((video) => {
    if (video.querySelector('.zl-collect-btn')) return;
    
    const button = document.createElement('button');
    button.className = 'zl-collect-btn';
    button.innerHTML = '采集';
    button.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px 8px;
      background: rgba(255, 95, 69, 0.9);
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 10;
    `;
    
    video.style.position = 'relative';
    video.appendChild(button);
    
    video.addEventListener('mouseenter', () => {
      button.style.opacity = '1';
    });
    
    video.addEventListener('mouseleave', () => {
      button.style.opacity = '0';
    });
    
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const link = video.querySelector('a[href*="/short-video/"]') as HTMLAnchorElement;
      if (!link) {
        showToast('无法获取视频链接', 'error');
        return;
      }
      
      const postId = link.href.match(/\/short-video\/([\w]+)/)?.[1];
      if (!postId) {
        showToast('无法获取视频ID', 'error');
        return;
      }
      
      const cachedPost = collectedPosts.get(postId);
      if (cachedPost) {
        button.innerHTML = '采集中...';
        const response = await sendMessage('collect:post', {
          platform: 'kuaishou',
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

function createCollectButton(text: string, onClick: () => void): HTMLElement {
  const container = document.createElement('div');
  const shadow = container.attachShadow({ mode: 'open' });
  
  shadow.innerHTML = `
    <style>
      button {
        padding: 8px 16px;
        background: #ff5f45;
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
        background: #e6523b;
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
