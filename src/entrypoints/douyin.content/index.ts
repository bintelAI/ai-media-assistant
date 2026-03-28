import { sendMessage } from '@/shared/utils/messaging';
import type { PageType } from '@/shared/types';
import type { PostEntity, AuthorEntity } from '@/shared/types/entities';

let currentPageType: PageType = 'unknown';
let injectedUI: HTMLElement | null = null;

const collectedPosts: Map<string, Partial<PostEntity>> = new Map();
const collectedAuthors: Map<string, Partial<AuthorEntity>> = new Map();

export default defineContentScript({
  matches: ['*://www.douyin.com/*'],
  runAt: 'document_start',
  
  main() {
    console.log('[智联采集] 抖音 Content Script 已加载');
    
    setupXhrInterceptor();
    
    currentPageType = detectDYPage(window.location.href);
    
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
  
  console.log('[智联采集] 抖音 XHR 拦截器已设置');
}

function isDataApiUrl(url: string): boolean {
  const dataApis = [
    '/aweme/v1/web/aweme/detail/',
    '/aweme/v1/web/aweme/post/',
    '/aweme/v1/web/user/profile/',
    '/aweme/v1/web/search/item/',
    '/aweme/v1/web/feed/',
    '/v1/web/user/posts/',
  ];
  
  return dataApis.some(api => url.includes(api));
}

function handleApiData(url: string, data: any) {
  if (!data) return;
  
  console.log('[智联采集] 抖音拦截到数据:', url.split('?')[0]);
  
  if (url.includes('/aweme/detail/') || url.includes('/aweme/post/')) {
    handleVideoDetailData(data);
  } else if (url.includes('/user/profile/') || url.includes('/user/posts/')) {
    handleUserData(data);
  } else if (url.includes('/search/item/') || url.includes('/feed/')) {
    handleFeedData(data);
  }
}

function handleVideoDetailData(data: any) {
  const aweme = data?.aweme_detail || data?.data?.aweme_detail;
  if (!aweme?.aweme_id) return;
  
  const postData = extractPostData(aweme);
  if (postData) {
    collectedPosts.set(aweme.aweme_id, postData);
    console.log(`[智联采集] 抖音缓存视频: ${aweme.aweme_id}`);
  }
}

function handleUserData(data: any) {
  const user = data?.user || data?.data?.user;
  if (!user?.uid) return;
  
  const authorData = extractAuthorData(user);
  if (authorData) {
    collectedAuthors.set(user.uid, authorData);
    console.log(`[智联采集] 抖音缓存用户: ${user.uid} - ${authorData.name}`);
  }
}

function handleFeedData(data: any) {
  const items = data?.data || data?.aweme_list || [];
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
    console.log(`[智联采集] 抖音缓存 ${count} 条视频数据`);
    debouncedSavePosts();
  }
}

function extractPostData(aweme: any): Partial<PostEntity> | null {
  if (!aweme?.aweme_id) return null;
  
  const author = aweme.author || {};
  const statistics = aweme.statistics || {};
  
  return {
    platform: 'douyin',
    postId: aweme.aweme_id,
    postType: aweme.video ? 'video' : 'image',
    title: aweme.desc || aweme.title || '',
    content: aweme.desc || '',
    url: `https://www.douyin.com/video/${aweme.aweme_id}`,
    coverUrl: aweme.video?.cover?.url_list?.[0] || aweme.cover?.url_list?.[0],
    publishTime: aweme.create_time ? new Date(aweme.create_time * 1000).toISOString() : undefined,
    authorId: author.uid,
    authorName: author.nickname || author.name,
    authorUrl: author.uid ? `https://www.douyin.com/user/MS4wLjABAAAA${author.uid}` : undefined,
    likeCount: statistics.digg_count,
    commentCount: statistics.comment_count,
    collectCount: statistics.collect_count,
    shareCount: statistics.share_count,
    viewCount: statistics.play_count,
    mediaCount: aweme.images?.length || 1,
    tags: aweme.text_extra?.map((t: any) => t.hashtag_name).filter(Boolean) || [],
    sourcePageUrl: window.location.href,
    sourcePageType: 'feed_list'
  };
}

function extractAuthorData(user: any): Partial<AuthorEntity> | null {
  if (!user?.uid) return null;
  
  return {
    platform: 'douyin',
    authorId: user.uid,
    name: user.nickname || user.name || '',
    avatar: user.avatar_thumb?.url_list?.[0] || user.avatar_url,
    profileUrl: `https://www.douyin.com/user/MS4wLjABAAAA${user.uid}`,
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
  console.log('[智联采集] 抖音页面加载完成:', currentPageType);
  
  setTimeout(() => {
    injectUIByPageType(currentPageType);
  }, 1000);
}

function detectDYPage(url: string): PageType {
  if (url.match(/\/video\/\d+/)) {
    return 'post_detail';
  }
  
  if (url.includes('/user/') || url.match(/\/user\/MS4wLjABAAAA/)) {
    return 'author_profile';
  }
  
  if (url.includes('/search/')) {
    return 'search_result';
  }
  
  if (url === 'https://www.douyin.com' || url.includes('/recommend')) {
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
  
  observer.observe(document.body, { childList: true, subtree: true });
}

function onPageChanged(pageType: PageType) {
  console.log('[智联采集] 抖音页面切换:', pageType);
  
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
  const container = document.querySelector('[data-e2e="video-desc"], .video-info-detail, #videoDesc');
  if (!container) {
    setTimeout(injectPostPageUI, 500);
    return;
  }
  
  const button = createCollectButton('采集视频', async () => {
    button.textContent = '采集中...';
    button.disabled = true;
    
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
  const container = document.querySelector('[data-e2e="user-info"], .user-info, #user-info');
  if (!container) {
    setTimeout(injectAuthorPageUI, 500);
    return;
  }
  
  const button = createCollectButton('采集作者', async () => {
    button.textContent = '采集中...';
    button.disabled = true;
    
    const match = window.location.href.match(/\/user\/(MS4wLjABAAAA[\w-]+)/);
    const authorId = match?.[1];
    const cachedAuthor = authorId ? collectedAuthors.get(authorId) : null;
    
    if (cachedAuthor) {
      const response = await sendMessage('collect:author', {
        platform: 'douyin',
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
  const videos = document.querySelectorAll('[data-e2e="recommend-list-item"], .video-card, .aweme-card');
  
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
      button:hover {
        background: #e0284d;
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
