import { sendMessage } from '@/shared/utils/messaging';
import type { PageType } from '@/shared/types';
import type { PostEntity, AuthorEntity } from '@/shared/types/entities';

let currentPageType: PageType = 'unknown';
let injectedUI: HTMLElement | null = null;

const collectedPosts: Map<string, Partial<PostEntity>> = new Map();
const collectedAuthors: Map<string, Partial<AuthorEntity>> = new Map();

export default defineContentScript({
  matches: ['*://pgy.xiaohongshu.com/*'],
  runAt: 'document_start',
  
  main() {
    console.log('[智联采集] 蒲公英 Content Script 已加载');
    
    setupXhrInterceptor();
    
    currentPageType = detectPgyPage(window.location.href);
    
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
  
  console.log('[智联采集] 蒲公英 XHR 拦截器已设置');
}

function isDataApiUrl(url: string): boolean {
  const dataApis = [
    '/api/creator/',
    '/api/note/',
    '/api/user/',
    '/daren/',
    '/creator/',
  ];
  
  return dataApis.some(api => url.includes(api));
}

function handleApiData(url: string, data: any) {
  if (!data) return;
  
  console.log('[智联采集] 蒲公英拦截到数据:', url.split('?')[0]);
  
  if (url.includes('/creator/') || url.includes('/user/')) {
    handleCreatorData(data);
  } else if (url.includes('/note/') || url.includes('/daren/')) {
    handleNoteData(data);
  }
}

function handleCreatorData(data: any) {
  const creator = data?.data?.creator || data?.creator || data?.data;
  if (!creator?.user_id && !creator?.id) return;
  
  const authorData = extractAuthorData(creator);
  if (authorData) {
    collectedAuthors.set(authorData.authorId!, authorData);
    console.log(`[智联采集] 蒲公英缓存创作者: ${authorData.authorId} - ${authorData.name}`);
  }
}

function handleNoteData(data: any) {
  const notes = data?.data?.list || data?.data?.notes || [data?.data?.note].filter(Boolean);
  
  notes.forEach((note: any) => {
    if (!note?.note_id && !note?.id) return;
    
    const postData = extractPostData(note);
    if (postData) {
      collectedPosts.set(postData.postId!, postData);
    }
  });
  
  if (collectedPosts.size > 0) {
    console.log(`[智联采集] 蒲公英缓存笔记数据`);
    debouncedSavePosts();
  }
}

function extractPostData(note: any): Partial<PostEntity> | null {
  if (!note?.note_id && !note?.id) return null;
  
  const author = note.author || note.user || {};
  const platform = window.location.hostname.includes('xiaohongshu') ? 'xhs' : 'pgy';
  
  return {
    platform: platform as any,
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
    sourcePageUrl: window.location.href,
    sourcePageType: 'feed_list'
  };
}

function extractAuthorData(user: any): Partial<AuthorEntity> | null {
  if (!user?.user_id && !user?.id) return null;
  
  const platform = window.location.hostname.includes('xiaohongshu') ? 'xhs' : 'pgy';
  
  return {
    platform: platform as any,
    authorId: user.user_id || user.id,
    name: user.nickname || user.name || '',
    avatar: user.avatar?.url || user.head_url || user.image,
    profileUrl: `https://www.xiaohongshu.com/user/profile/${user.user_id || user.id}`,
    bio: user.signature || user.desc,
    fansCount: user.fans_count || user.follower_count,
    followCount: user.follow_count || user.following_count,
    likedCount: user.liked_count || user.total_liked_count,
    workCount: user.note_count || user.work_count,
    verified: !!user.verified,
    verifiedDesc: user.verified_reason,
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
  console.log('[智联采集] 蒲公英页面加载完成:', currentPageType);
  
  setTimeout(() => {
    injectUIByPageType(currentPageType);
  }, 1000);
}

function detectPgyPage(url: string): PageType {
  if (url.includes('/creator/') || url.includes('/user/')) {
    return 'author_profile';
  }
  
  if (url.includes('/note/') || url.includes('/video/')) {
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
      const newPageType = detectPgyPage(window.location.href);
      
      if (newPageType !== currentPageType) {
        currentPageType = newPageType;
        onPageChanged(newPageType);
      }
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}

function onPageChanged(pageType: PageType) {
  console.log('[智联采集] 蒲公英页面切换:', pageType);
  
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
  const container = document.querySelector('.note-detail, [class*="note-content"], [class*="detail-content"]');
  if (!container) {
    setTimeout(injectPostPageUI, 500);
    return;
  }
  
  const button = createCollectButton('采集笔记', async () => {
    button.textContent = '采集中...';
    button.disabled = true;
    
    const match = window.location.href.match(/\/note\/([\w]+)/);
    const postId = match?.[1];
    const cachedPost = postId ? collectedPosts.get(postId) : null;
    
    if (cachedPost) {
      const response = await sendMessage('collect:post', {
        platform: cachedPost.platform,
        post: cachedPost
      });
      
      if (response.success) {
        showToast('已保存到本地', 'success');
        button.textContent = '已采集';
      } else {
        showToast('采集失败: ' + response.error, 'error');
        button.textContent = '采集笔记';
        button.disabled = false;
      }
    } else {
      showToast('数据加载中，请稍后重试', 'info');
      button.textContent = '采集笔记';
      button.disabled = false;
    }
  });
  
  container.appendChild(button);
  injectedUI = button;
}

function injectAuthorPageUI() {
  const container = document.querySelector('.creator-info, [class*="creator-info"], [class*="user-info"]');
  if (!container) {
    setTimeout(injectAuthorPageUI, 500);
    return;
  }
  
  const button = createCollectButton('采集创作者', async () => {
    button.textContent = '采集中...';
    button.disabled = true;
    
    const match = window.location.href.match(/\/(creator|user)\/([\w]+)/);
    const authorId = match?.[2];
    const cachedAuthor = authorId ? collectedAuthors.get(authorId) : null;
    
    if (cachedAuthor) {
      const response = await sendMessage('collect:author', {
        platform: cachedAuthor.platform,
        author: cachedAuthor
      });
      
      if (response.success) {
        showToast('已保存到本地', 'success');
        button.textContent = '已采集';
      } else {
        showToast('采集失败: ' + response.error, 'error');
        button.textContent = '采集创作者';
        button.disabled = false;
      }
    } else {
      showToast('数据加载中，请稍后重试', 'info');
      button.textContent = '采集创作者';
      button.disabled = false;
    }
  });
  
  container.appendChild(button);
  injectedUI = button;
}

function injectListPageUI() {
  const items = document.querySelectorAll('[class*="note-item"], [class*="creator-item"], .list-item');
  
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
      background: rgba(255, 193, 7, 0.9);
      color: #333;
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
      showToast('数据加载中，请稍后重试', 'info');
      button.innerHTML = '采集';
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
        background: #ffc107;
        color: #333;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
        margin-left: 12px;
      }
      button:hover {
        background: #ffb300;
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
