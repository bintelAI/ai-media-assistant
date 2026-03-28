import { sendMessage } from '@/shared/utils/messaging';
import type { PageType } from '@/shared/types';
import type { PostEntity, AuthorEntity } from '@/shared/types/entities';

let currentPageType: PageType = 'unknown';
let injectedUI: HTMLElement | null = null;

const collectedPosts: Map<string, Partial<PostEntity>> = new Map();
const collectedAuthors: Map<string, Partial<AuthorEntity>> = new Map();

export default defineContentScript({
  matches: ['*://www.xiaohongshu.com/*'],
  runAt: 'document_start',
  
  main() {
    console.log('[智联AI] 小红书 Content Script 已加载');
    
    setupXhrInterceptor();
    
    currentPageType = detectXHSPage(window.location.href);
    
    window.addEventListener('load', () => {
      onPageLoaded();
    });
    
    observePageChanges();
  }
});

function setupXhrInterceptor() {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const self = this;
  
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
  
  console.log('[智联AI] XHR 拦截器已设置');
}

function isDataApiUrl(url: string): boolean {
  const dataApis = [
    '/api/sns/web/v1/homefeed',
    '/api/sns/web/v1/search/notes',
    '/api/sns/web/v1/user_posted',
    '/api/sns/web/v2/note/',
    '/api/sns/web/v1/note/',
    '/api/sns/web/v2/user/',
  ];
  
  return dataApis.some(api => url.includes(api));
}

function handleApiData(url: string, data: any) {
  if (!data || !data.data) return;
  
  console.log('[智联AI] 拦截到数据:', url.split('?')[0]);
  
  if (url.includes('/api/sns/web/v1/homefeed') || url.includes('/api/sns/web/v1/search/notes')) {
    handleFeedData(data);
  } else if (url.includes('/api/sns/web/v1/user_posted')) {
    handleUserPostsData(data);
  } else if (url.includes('/api/sns/web/v2/note/') || url.includes('/api/sns/web/v1/note/')) {
    handleNoteDetailData(data);
  } else if (url.includes('/api/sns/web/v2/user/')) {
    handleUserData(data);
  }
}

function handleFeedData(data: any) {
  const items = data.data?.items || data.data?.notes || [];
  let count = 0;
  
  items.forEach((item: any) => {
    const note = item.note || item;
    if (!note?.noteId) return;
    
    const postData = extractPostData(note);
    if (postData) {
      collectedPosts.set(note.noteId, postData);
      count++;
    }
  });
  
  if (count > 0) {
    console.log(`[智联AI] 缓存 ${count} 条帖子数据`);
    debouncedSavePosts();
  }
}

function handleUserPostsData(data: any) {
  const notes = data.data?.notes || [];
  let count = 0;
  
  notes.forEach((noteItem: any) => {
    const note = noteItem.note || noteItem;
    if (!note?.noteId) return;
    
    const postData = extractPostData(note);
    if (postData) {
      collectedPosts.set(note.noteId, postData);
      count++;
    }
  });
  
  if (count > 0) {
    console.log(`[智联AI] 缓存用户帖子 ${count} 条`);
    debouncedSavePosts();
  }
}

function handleNoteDetailData(data: any) {
  const note = data.data?.note;
  if (!note?.noteId) return;
  
  const postData = extractPostData(note);
  if (postData) {
    collectedPosts.set(note.noteId, postData);
    console.log(`[智联AI] 缓存帖子详情: ${note.noteId}`);
  }
}

function handleUserData(data: any) {
  const user = data.data?.user || data.data;
  if (!user?.userId) return;
  
  const authorData = extractAuthorData(user);
  if (authorData) {
    collectedAuthors.set(user.userId, authorData);
    console.log(`[智联AI] 缓存用户数据: ${user.userId} - ${authorData.name}`);
  }
}

function extractPostData(note: any): Partial<PostEntity> | null {
  if (!note?.noteId) return null;
  
  const user = note.user || {};
  const interactInfo = note.interactInfo || {};
  
  return {
    platform: 'xhs',
    postId: note.noteId,
    postType: note.type === 'video' ? 'video' : 'image',
    title: note.title || note.displayTitle || '',
    content: note.desc || '',
    url: `https://www.xiaohongshu.com/explore/${note.noteId}`,
    coverUrl: note.imageList?.[0]?.urlDefault || note.cover?.urlDefault,
    publishTime: note.time ? new Date(note.time).toISOString() : undefined,
    authorId: user.userId,
    authorName: user.nickname || user.name,
    authorUrl: user.userId ? `https://www.xiaohongshu.com/user/profile/${user.userId}` : undefined,
    likeCount: interactInfo.likeCount,
    commentCount: interactInfo.commentCount,
    collectCount: interactInfo.collectCount,
    shareCount: interactInfo.shareCount,
    mediaCount: note.imageList?.length || (note.video ? 1 : 0),
    tags: note.tagList?.map((t: any) => t.name || t) || [],
    sourcePageUrl: window.location.href,
    sourcePageType: 'feed_list'
  };
}

function extractAuthorData(user: any): Partial<AuthorEntity> | null {
  if (!user?.userId) return null;
  
  return {
    platform: 'xhs',
    authorId: user.userId,
    name: user.nickname || user.name || '',
    avatar: user.image || user.avatar,
    profileUrl: `https://www.xiaohongshu.com/user/profile/${user.userId}`,
    bio: user.desc || user.bio,
    fansCount: user.fansCount || user.fans,
    followCount: user.followCount || user.follows,
    likedCount: user.likedCount || user.liked,
    workCount: user.noteCount || user.notesCount,
    location: user.location,
    verified: !!user.verified,
    verifiedDesc: user.verifiedInfo?.desc || user.verifiedDesc,
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
  console.log('[智联AI] 页面加载完成:', currentPageType);
  
  const state = (window as any).__INITIAL_STATE__;
  if (state) {
    if (currentPageType === 'post_detail') {
      extractPostFromState(state);
    } else if (currentPageType === 'author_profile') {
      extractAuthorFromState(state);
    }
  }
  
  setTimeout(() => {
    injectUIByPageType(currentPageType);
  }, 1000);
}

function extractPostFromState(state: any) {
  const noteId = window.location.pathname.split('/').pop();
  const noteData = state?.note?.noteDetailMap?.[noteId as any];
  
  if (noteData?.note) {
    const postData = extractPostData(noteData.note);
    if (postData) {
      collectedPosts.set(noteData.note.noteId, postData);
      console.log('[智联AI] 从页面状态缓存帖子:', noteId);
    }
  }
}

function extractAuthorFromState(state: any) {
  const userInfo = state?.user?.userPageInfo || state?.userPageInfo;
  
  if (userInfo?.basicInfo) {
    const basicInfo = userInfo.basicInfo;
    const interactions = userInfo.interactions || [];
    
    const getInteraction = (name: string): number | undefined => {
      const item = interactions.find((i: any) => i.name === name);
      return item?.count;
    };
    
    const authorData: Partial<AuthorEntity> = {
      platform: 'xhs',
      authorId: basicInfo.userId,
      name: basicInfo.nickname || '',
      avatar: basicInfo.image,
      profileUrl: `https://www.xiaohongshu.com/user/profile/${basicInfo.userId}`,
      bio: basicInfo.desc,
      fansCount: getInteraction('粉丝') ?? basicInfo.fansCount,
      followCount: getInteraction('关注') ?? basicInfo.followCount,
      likedCount: getInteraction('获赞与收藏') ?? getInteraction('获赞') ?? basicInfo.likedCount,
      location: basicInfo.location,
      verified: !!basicInfo.verified,
      verifiedDesc: basicInfo.verifiedInfo?.desc,
      sourcePageUrl: window.location.href
    };
    
    collectedAuthors.set(basicInfo.userId, authorData);
    console.log('[智联AI] 从页面状态缓存用户:', basicInfo.userId, authorData);
  }
}

function detectXHSPage(url: string): PageType {
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

function observePageChanges() {
  let lastUrl = window.location.href;
  
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      const newPageType = detectXHSPage(window.location.href);
      
      if (newPageType !== currentPageType) {
        currentPageType = newPageType;
        onPageChanged(newPageType);
      }
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}

function onPageChanged(pageType: PageType) {
  console.log('[智联AI] 页面切换:', pageType);
  
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
  const container = document.querySelector('.note-container, .note-content, #detail-desc');
  if (!container) {
    setTimeout(injectPostPageUI, 500);
    return;
  }
  
  const button = createCollectButton('采集帖子', async () => {
    button.textContent = '采集中...';
    button.disabled = true;
    
    const postId = window.location.pathname.split('/').pop();
    const cachedPost = postId ? collectedPosts.get(postId) : null;
    
    if (cachedPost) {
      const response = await sendMessage('collect:post', {
        platform: 'xhs',
        post: cachedPost
      });
      
      if (response.success) {
        showToast('已保存到本地', 'success');
        button.textContent = '已采集';
      } else {
        showToast('采集失败: ' + response.error, 'error');
        button.textContent = '采集帖子';
        button.disabled = false;
      }
    } else {
      showToast('数据加载中，请稍后重试', 'info');
      button.textContent = '采集帖子';
      button.disabled = false;
    }
  });
  
  container.appendChild(button);
  injectedUI = button;
}

function injectAuthorPageUI() {
  const container = document.querySelector('.user-info, .user-side, .user-basic-info');
  if (!container) {
    setTimeout(injectAuthorPageUI, 500);
    return;
  }
  
  const button = createCollectButton('采集作者', async () => {
    button.textContent = '采集中...';
    button.disabled = true;
    
    const authorId = window.location.pathname.split('/').pop();
    const cachedAuthor = authorId ? collectedAuthors.get(authorId) : null;
    
    if (cachedAuthor) {
      const response = await sendMessage('collect:author', {
        platform: 'xhs',
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
  const posts = document.querySelectorAll('.note-item, .feeds-page .note-list > div');
  
  posts.forEach((post) => {
    if (post.querySelector('.zl-collect-btn')) return;
    
    const button = document.createElement('button');
    button.className = 'zl-collect-btn';
    button.innerHTML = '采集';
    button.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px 8px;
      background: rgba(255, 36, 66, 0.9);
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 10;
    `;
    
    post.style.position = 'relative';
    post.appendChild(button);
    
    post.addEventListener('mouseenter', () => {
      button.style.opacity = '1';
    });
    
    post.addEventListener('mouseleave', () => {
      button.style.opacity = '0';
    });
    
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const link = post.querySelector('a[href*="/explore/"]') as HTMLAnchorElement;
      if (!link) {
        showToast('无法获取帖子链接', 'error');
        return;
      }
      
      const postId = link.href.match(/\/explore\/([\w]+)/)?.[1];
      if (!postId) {
        showToast('无法获取帖子ID', 'error');
        return;
      }
      
      const cachedPost = collectedPosts.get(postId);
      if (cachedPost) {
        button.innerHTML = '采集中...';
        const response = await sendMessage('collect:post', {
          platform: 'xhs',
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
        background: #ff2442;
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
        background: #e01f3a;
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
