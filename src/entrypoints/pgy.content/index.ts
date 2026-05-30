import { sendMessage } from '@/shared/utils/messaging';
import { ChromeStorage } from '@/shared/utils/storage';
import { SETTINGS_STORAGE_KEY, unwrapStoredSettings, type StoredAppSettings } from '@/shared/utils/constants';
import type { PageType } from '@/shared/types';
import type { PostEntity, AuthorEntity } from '@/shared/types/entities';

interface PgyInterceptEventDetail {
  url: string;
  data: any;
  method?: string;
  body?: any;
}

let currentPageType: PageType = 'unknown';
let injectedUI: HTMLElement | null = null;
let floatingButton: HTMLElement | null = null;

const collectedPosts: Map<string, Partial<PostEntity>> = new Map();
const collectedAuthors: Map<string, Partial<AuthorEntity>> = new Map();

export default defineContentScript({
  matches: ['*://pgy.xiaohongshu.com/*'],
  runAt: 'document_start',
  // 保持ISOLATED world以便访问chrome API
  // world: 'ISOLATED' 是默认值

  async main() {
    const state = unwrapStoredSettings(await ChromeStorage.getItem<StoredAppSettings>(SETTINGS_STORAGE_KEY));
    if (!state?.devMode) {
      console.info('[智联AI] 蒲公英暂未支持，普通模式不注入采集脚本');
      return;
    }
    document.documentElement.dataset.zlPgyDevMode = 'true';
    window.dispatchEvent(new CustomEvent('zl_pgy_dev_mode_enabled'));

    console.log('[智联AI] 蒲公英 ISOLATED world 脚本已加载');

    // 创建根容器（参考靓号项目）
    const pluginRoot = document.createElement('yes-plugin');
    pluginRoot.id = 'yes-plugin-root';
    pluginRoot.className = 'yes-plugin-root';

    window.addEventListener('zl_pgy_api_intercepted', (e: Event) => {
      const customEvent = e as CustomEvent<PgyInterceptEventDetail>;
      const { url, data, method, body } = customEvent.detail;
      handleApiData(url, data, method, body);
    });

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'pgy:api:call') {
        console.log('[智联AI] 蒲公英 ISOLATED world 收到API调用消息:', message);

        const requestId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        let isResponded = false;

        const cleanup = () => {
          window.removeEventListener('message', handleResponse);
          window.removeEventListener('message', handleError);
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        };

        const timeoutId = setTimeout(() => {
          if (!isResponded) {
            cleanup();
            console.error('[智联AI] 蒲公英 API 请求超时');
            sendResponse({ success: false, error: '请求超时，请刷新页面后重试' });
            isResponded = true;
          }
        }, 30000);

        const handleResponse = (event: MessageEvent) => {
          if (event.data?.type === 'zl_pgy_api_response' &&
              event.data?.requestId === requestId &&
              event.data?.source === 'main') {
            if (!isResponded) {
              cleanup();
              console.log('[智联AI] 蒲公英 API 响应:', event.data);
              sendResponse({ success: true, data: event.data.response });
              isResponded = true;
            }
          }
        };

        const handleError = (event: MessageEvent) => {
          if (event.data?.type === 'zl_pgy_api_error' &&
              event.data?.requestId === requestId &&
              event.data?.source === 'main') {
            if (!isResponded) {
              cleanup();
              console.log('[智联AI] 蒲公英 API 错误:', event.data);
              sendResponse({ success: false, error: event.data.error });
              isResponded = true;
            }
          }
        };

        window.addEventListener('message', handleResponse);
        window.addEventListener('message', handleError);

        window.postMessage({
          type: 'zl_pgy_api_request',
          requestId,
          source: 'isolated',
          method: message.method || 'GET',
          path: message.path,
          params: message.params,
        }, '*');

        return true;
      }
    });

    currentPageType = detectPgyPage(window.location.href);

    pluginRoot.setAttribute('data-platform', 'pgy');

    window.addEventListener('load', () => {
      // 在页面加载完成后添加根容器到DOM
      (document.body ?? document.documentElement).appendChild(pluginRoot);
      console.log('[智联AI] 创建yes-plugin根容器');
      onPageLoaded();
    });

    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 'y') {
        e.preventDefault();
        handleApprove(true);
      }
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        handleApprove(false);
      }
    });

    observePageChanges();
  }
});

function handleApiData(url: string, data: any, method?: string, body?: any) {
  if (!data) return;

  console.log('[智联AI] 蒲公英拦截到数据:', url.split('?')[0], method);

  if (url.includes('/creator/') || url.includes('/user/')) {
    handleCreatorData(data);
  }
  if (url.includes('/note/') || url.includes('/daren/')) {
    handleNoteData(data);
  }
  if (url.includes('/demand/')) {
    handleDemandData(data);
  }
}

function handleCreatorData(data: any) {
  const creator = data?.data?.creator || data?.creator || data?.data;
  if (!creator?.user_id && !creator?.id) return;

  const authorData = extractAuthorData(creator);
  if (authorData) {
    collectedAuthors.set(authorData.authorId!, authorData);
    console.log(`[智联AI] 蒲公英缓存创作者: ${authorData.authorId} - ${authorData.name}`);
    debouncedSaveAuthors();
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
    console.log(`[智联AI] 蒲公英缓存笔记数据`);
    debouncedSavePosts();
  }
}

function handleDemandData(data: any) {
  const demands = data?.data?.list || data?.data?.demands || [data?.data].filter(Boolean);

  demands.forEach((demand: any) => {
    if (!demand?.demand_id && !demand?.id) return;

    const postData = extractPostData(demand);
    if (postData) {
      collectedPosts.set(postData.postId!, postData);
    }
  });

  if (collectedPosts.size > 0) {
    console.log(`[智联AI] 蒲公英缓存需求/合作数据`);
    debouncedSavePosts();
  }
}

function extractPostData(note: any): Partial<PostEntity> | null {
  if (!note?.note_id && !note?.id) return null;

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
    sourcePageUrl: window.location.href,
    sourcePageType: 'feed_list',
  };
}

function extractAuthorData(user: any): Partial<AuthorEntity> | null {
  if (!user?.user_id && !user?.id) return null;

  return {
    platform: 'pgy',
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
    sourcePageUrl: window.location.href,
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

let saveAuthorsTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedSaveAuthors() {
  if (saveAuthorsTimer) {
    clearTimeout(saveAuthorsTimer);
  }
  saveAuthorsTimer = setTimeout(() => {
    for (const [, author] of collectedAuthors) {
      sendMessage('cache:author', { author });
    }
    saveAuthorsTimer = null;
  }, 1000);
}

function onPageLoaded() {
  console.log('[智联AI] 蒲公英页面加载完成:', currentPageType);

  injectFloatingButton();

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

  observer.observe(document.documentElement || document, { childList: true, subtree: true });
}

function onPageChanged(pageType: PageType) {
  console.log('[智联AI] 蒲公英页面切换:', pageType);

  removeInjectedUI();

  setTimeout(() => {
    injectUIByPageType(pageType);
  }, 1000);
}

function injectFloatingButton() {
  if (floatingButton) return;

  // 先注入全局样式
  const styleEl = document.createElement('style');
  styleEl.id = 'zl-pgy-styles';
  styleEl.textContent = `
    /* 浮动按钮样式（参考靓号项目） */
    .zl-floating-container {
      position: fixed;
      bottom: 150px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    .zl-floating-btn {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: all 0.2s;
      font-size: 20px;
    }
    .zl-floating-btn:hover {
      transform: scale(1.1);
    }
    .zl-main-btn {
      background: #ffc107;
      color: #333;
    }
    .zl-sub-btn {
      background: #3b82f6;
      color: white;
      width: 40px;
      height: 40px;
      font-size: 16px;
    }
    .zl-sub-btn.zl-collect {
      background: #22c55e;
    }
    .zl-sub-btn.zl-batch {
      background: #f59e0b;
    }
    .zl-sub-btn.zl-invite {
      background: #8b5cf6;
    }
    .zl-sub-btn.zl-records {
      background: #06b6d4;
    }
    .zl-sub-btn.zl-approve {
      background: #22c55e;
    }
    .zl-sub-btn.zl-reject {
      background: #ef4444;
      color: white;
    }
    .zl-menu-hidden .zl-sub-btn {
      display: none;
    }
    /* Toast样式 */
    .zl-toast {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10001;
      animation: zl-slide-in 0.3s ease;
    }
    .zl-toast.zl-success {
      background: #22c55e;
      color: white;
    }
    .zl-toast.zl-error {
      background: #ef4444;
      color: white;
    }
    .zl-toast.zl-info {
      background: #3b82f6;
      color: white;
    }
    @keyframes zl-slide-in {
      from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `;
  (document.head ?? document.documentElement).appendChild(styleEl);

  // 创建浮动按钮容器
  const container = document.createElement('div');
  container.className = 'zl-floating-container zl-menu-hidden';

  const buttons = [
    { id: 'zlMainBtn', class: 'zl-floating-btn zl-main-btn', title: '智联AI', text: '🤖' },
    { id: 'zlQuickCollect', class: 'zl-floating-btn zl-sub-btn zl-collect', title: '快速采集当前页', text: '📥' },
    { id: 'zlBatchCollect', class: 'zl-floating-btn zl-sub-btn zl-batch', title: '批量采集', text: '📦' },
    { id: 'zlBatchInvite', class: 'zl-floating-btn zl-sub-btn zl-invite', title: '批量邀约', text: '✉️' },
    { id: 'zlInviteRecords', class: 'zl-floating-btn zl-sub-btn zl-records', title: '邀约记录', text: '📋' },
    { id: 'zlApproveBtn', class: 'zl-floating-btn zl-sub-btn zl-approve', title: '审核通过(Alt+Y)', text: '✅' },
    { id: 'zlRejectBtn', class: 'zl-floating-btn zl-sub-btn zl-reject', title: '审核拒绝(Alt+N)', text: '❌' },
  ];

  buttons.forEach(btn => {
    const el = document.createElement('button');
    el.id = btn.id;
    el.className = btn.class;
    el.title = btn.title;
    el.textContent = btn.text;
    container.appendChild(el);
  });

  document.body.appendChild(container);
  floatingButton = container;

  // 事件绑定
  const mainBtn = container.querySelector('#zlMainBtn') as HTMLButtonElement;
  const quickCollectBtn = container.querySelector('#zlQuickCollect') as HTMLButtonElement;
  const batchCollectBtn = container.querySelector('#zlBatchCollect') as HTMLButtonElement;
  const batchInviteBtn = container.querySelector('#zlBatchInvite') as HTMLButtonElement;
  const inviteRecordsBtn = container.querySelector('#zlInviteRecords') as HTMLButtonElement;
  const approveBtn = container.querySelector('#zlApproveBtn') as HTMLButtonElement;
  const rejectBtn = container.querySelector('#zlRejectBtn') as HTMLButtonElement;

  mainBtn.addEventListener('click', () => {
    container.classList.toggle('zl-menu-hidden');
  });

  quickCollectBtn.addEventListener('click', async () => {
    quickCollectBtn.textContent = '⏳';
    await handleQuickCollect();
    quickCollectBtn.textContent = '📥';
  });

  batchCollectBtn.addEventListener('click', () => {
    showBatchCollectModal();
  });

  batchInviteBtn.addEventListener('click', () => {
    showBatchInviteModal();
  });

  inviteRecordsBtn.addEventListener('click', () => {
    showInviteRecordsModal();
  });

  approveBtn.addEventListener('click', () => {
    handleApprove(true);
  });

  rejectBtn.addEventListener('click', () => {
    handleApprove(false);
  });
}

async function handleQuickCollect() {
  const pageType = currentPageType;

  if (pageType === 'author_profile') {
    const match = window.location.href.match(/\/(creator|user)\/([\w]+)/);
    const authorId = match?.[2];
    const cachedAuthor = authorId ? collectedAuthors.get(authorId) : null;

    if (cachedAuthor) {
      const response = await sendMessage('collect:author', {
        platform: 'pgy',
        author: cachedAuthor,
      });
      if (response.success) {
        showToast('创作者已保存', 'success');
      } else {
        showToast('保存失败: ' + response.error, 'error');
      }
    } else {
      showToast('数据加载中，请稍后重试', 'info');
    }
  } else if (pageType === 'post_detail') {
    const match = window.location.href.match(/\/note\/([\w]+)/);
    const postId = match?.[1];
    const cachedPost = postId ? collectedPosts.get(postId) : null;

    if (cachedPost) {
      const response = await sendMessage('collect:post', {
        platform: 'pgy',
        post: cachedPost,
      });
      if (response.success) {
        showToast('笔记已保存', 'success');
      } else {
        showToast('保存失败: ' + response.error, 'error');
      }
    } else {
      showToast('数据加载中，请稍后重试', 'info');
    }
  } else {
    const count = collectedPosts.size;
    if (count > 0) {
      showToast(`已缓存 ${count} 条数据`, 'success');
    } else {
      showToast('暂无缓存数据，请滚动页面加载数据', 'info');
    }
  }
}

function showBatchCollectModal() {
  const existingModal = document.querySelector('.zl-batch-modal');
  if (existingModal) {
    existingModal.remove();
    return;
  }

  // 注入模态框样式
  if (!document.querySelector('#zl-modal-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'zl-modal-styles';
    styleEl.textContent = `
      .zl-batch-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .zl-modal-content {
        background: white;
        border-radius: 12px;
        padding: 24px;
        width: 400px;
        max-width: 90vw;
      }
      .zl-modal-title {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 16px;
        color: #333;
      }
      .zl-modal-desc {
        font-size: 14px;
        color: #666;
        margin-bottom: 16px;
      }
      .zl-modal-stats {
        background: #f9fafb;
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 16px;
      }
      .zl-modal-stats-item {
        display: flex;
        justify-content: space-between;
        font-size: 14px;
        color: #666;
        margin-bottom: 4px;
      }
      .zl-modal-input-group {
        margin-bottom: 16px;
      }
      .zl-modal-input-group label {
        display: block;
        font-size: 14px;
        color: #333;
        margin-bottom: 8px;
      }
      .zl-modal-input-group textarea {
        width: 100%;
        height: 120px;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 12px;
        font-size: 14px;
        resize: vertical;
        box-sizing: border-box;
      }
      .zl-modal-input-group textarea:focus {
        outline: none;
        border-color: #ffc107;
      }
      .zl-modal-btn-group {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }
      .zl-modal-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      }
      .zl-modal-btn-cancel {
        background: #f3f4f6;
        color: #666;
      }
      .zl-modal-btn-confirm {
        background: #ffc107;
        color: #333;
      }
      .zl-modal-btn-confirm:hover {
        background: #ffb300;
      }
    `;
    (document.head ?? document.documentElement).appendChild(styleEl);
  }

  const modal = document.createElement('div');
  modal.className = 'zl-batch-modal';

  const content = document.createElement('div');
  content.className = 'zl-modal-content';

  const title = document.createElement('div');
  title.className = 'zl-modal-title';
  title.textContent = '批量采集';

  const desc = document.createElement('div');
  desc.className = 'zl-modal-desc';
  desc.textContent = '输入蒲公英创作者主页URL，每行一个，支持批量采集创作者信息';

  const stats = document.createElement('div');
  stats.className = 'zl-modal-stats';
  stats.innerHTML = `
    <div class="zl-modal-stats-item">
      <span>已缓存创作者:</span>
      <span>${collectedAuthors.size} 个</span>
    </div>
    <div class="zl-modal-stats-item">
      <span>已缓存笔记:</span>
      <span>${collectedPosts.size} 条</span>
    </div>
  `;

  const inputGroup = document.createElement('div');
  inputGroup.className = 'zl-modal-input-group';

  const label = document.createElement('label');
  label.textContent = '创作者主页URL（每行一个）';

  const textarea = document.createElement('textarea');
  textarea.placeholder = 'https://pgy.xiaohongshu.com/creator/xxx\nhttps://pgy.xiaohongshu.com/creator/yyy';

  inputGroup.appendChild(label);
  inputGroup.appendChild(textarea);

  const btnGroup = document.createElement('div');
  btnGroup.className = 'zl-modal-btn-group';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'zl-modal-btn zl-modal-btn-cancel';
  cancelBtn.textContent = '取消';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'zl-modal-btn zl-modal-btn-confirm';
  confirmBtn.textContent = '开始采集';

  btnGroup.appendChild(cancelBtn);
  btnGroup.appendChild(confirmBtn);

  content.appendChild(title);
  content.appendChild(desc);
  content.appendChild(stats);
  content.appendChild(inputGroup);
  content.appendChild(btnGroup);

  modal.appendChild(content);

  cancelBtn.addEventListener('click', () => {
    modal.remove();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  confirmBtn.addEventListener('click', async () => {
    const urls = textarea.value.trim().split('\n').filter(u => u.trim());
    if (urls.length === 0) {
      showToast('请输入至少一个URL', 'error');
      return;
    }

    confirmBtn.textContent = '采集中...';
    confirmBtn.disabled = true;

    const validUrls: string[] = [];
    for (const url of urls) {
      const trimmed = url.trim();
      if (trimmed.includes('pgy.xiaohongshu.com/creator/') || trimmed.includes('pgy.xiaohongshu.com/user/')) {
        validUrls.push(trimmed);
      }
    }

    if (validUrls.length === 0) {
      showToast('没有有效的蒲公英创作者URL', 'error');
      confirmBtn.textContent = '开始采集';
      confirmBtn.disabled = false;
      return;
    }

    try {
      const response = await sendMessage('batch:collect:start', { urls: validUrls });
      if (response.success) {
        showToast(`已添加 ${validUrls.length} 个URL到采集队列`, 'success');
        modal.remove();
      } else {
        showToast('启动批量采集失败: ' + response.error, 'error');
      }
    } catch (e) {
      showToast('批量采集异常', 'error');
    }

    confirmBtn.textContent = '开始采集';
    confirmBtn.disabled = false;
  });

  document.body.appendChild(modal);
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
  const selectors = [
    '.note-detail',
    '[class*="note-content"]',
    '[class*="detail-content"]',
    '.note-container',
    '[class*="NoteDetail"]',
    'main'
  ];

  let container: Element | null = null;
  for (const selector of selectors) {
    container = document.querySelector(selector);
    if (container) break;
  }

  if (!container) {
    setTimeout(injectPostPageUI, 500);
    return;
  }

  // 直接创建按钮，不使用Shadow DOM
  const button = document.createElement('button');
  button.className = 'zl-collect-post-btn';
  button.textContent = '采集笔记';
  button.style.cssText = `
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
  `;

  button.addEventListener('click', async () => {
    button.textContent = '采集中...';
    button.disabled = true;
    button.style.opacity = '0.6';
    button.style.cursor = 'not-allowed';

    const match = window.location.href.match(/\/(note|video)\/([\w]+)/);
    const postId = match?.[2];
    const cachedPost = postId ? collectedPosts.get(postId) : null;

    if (cachedPost) {
      const response = await sendMessage('collect:post', {
        platform: 'pgy',
        post: cachedPost,
      });

      if (response.success) {
        showToast('已保存到本地', 'success');
        button.textContent = '已采集';
      } else {
        showToast('采集失败: ' + response.error, 'error');
        button.textContent = '采集笔记';
        button.disabled = false;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
      }
    } else if (postId) {
      try {
        button.textContent = 'API获取中...';
        const apiResponse = await callPgyApi('GET', '/api/note/detail', { note_id: postId });

        if (apiResponse?.data?.note) {
          const postData = extractPostData(apiResponse.data.note);
          if (postData) {
            const saveResponse = await sendMessage('collect:post', {
              platform: 'pgy',
              post: postData,
            });

            if (saveResponse.success) {
              collectedPosts.set(postId, postData);
              showToast('已通过API获取并保存', 'success');
              button.textContent = '已采集';
              return;
            } else {
              showToast('保存失败: ' + saveResponse.error, 'error');
            }
          }
        }
        showToast('API获取数据为空', 'info');
      } catch (err) {
        showToast('API获取异常', 'error');
        console.warn('[智联AI] 蒲公英API获取笔记详情失败:', err);
      }
      button.textContent = '采集笔记';
      button.disabled = false;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
    } else {
      showToast('无法识别笔记ID', 'info');
      button.textContent = '采集笔记';
      button.disabled = false;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
    }
  });

  container.appendChild(button);
  injectedUI = button;
}

function injectAuthorPageUI() {
  const selectors = [
    '.creator-info',
    '[class*="creator-info"]',
    '[class*="user-info"]',
    '[class*="CreatorInfo"]',
    '[class*="UserInfo"]',
    'main'
  ];

  let container: Element | null = null;
  for (const selector of selectors) {
    container = document.querySelector(selector);
    if (container) break;
  }

  if (!container) {
    setTimeout(injectAuthorPageUI, 500);
    return;
  }

  // 创建按钮容器（不使用Shadow DOM）
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'zl-author-buttons';
  buttonsContainer.style.cssText = `
    display: inline-flex;
    gap: 8px;
    margin-left: 12px;
  `;

  // 采集创作者按钮
  const collectAuthorBtn = document.createElement('button');
  collectAuthorBtn.className = 'zl-collect-author-btn';
  collectAuthorBtn.textContent = '采集创作者';
  collectAuthorBtn.style.cssText = `
    padding: 8px 16px;
    background: #ffc107;
    color: #333;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
  `;

  // API获取按钮
  const fetchFromApiBtn = document.createElement('button');
  fetchFromApiBtn.className = 'zl-fetch-api-btn';
  fetchFromApiBtn.textContent = 'API获取';
  fetchFromApiBtn.style.cssText = `
    padding: 8px 16px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
  `;

  buttonsContainer.appendChild(collectAuthorBtn);
  buttonsContainer.appendChild(fetchFromApiBtn);

  collectAuthorBtn.addEventListener('click', async () => {
    collectAuthorBtn.textContent = '采集中...';
    collectAuthorBtn.disabled = true;
    collectAuthorBtn.style.opacity = '0.6';
    collectAuthorBtn.style.cursor = 'not-allowed';

    const match = window.location.href.match(/\/(creator|user)\/([\w]+)/);
    const authorId = match?.[2];
    const cachedAuthor = authorId ? collectedAuthors.get(authorId) : null;

    if (cachedAuthor) {
      const response = await sendMessage('collect:author', {
        platform: 'pgy',
        author: cachedAuthor,
      });

      if (response.success) {
        showToast('已保存到本地', 'success');
        collectAuthorBtn.textContent = '已采集';
      } else {
        showToast('采集失败: ' + response.error, 'error');
        collectAuthorBtn.textContent = '采集创作者';
        collectAuthorBtn.disabled = false;
        collectAuthorBtn.style.opacity = '1';
        collectAuthorBtn.style.cursor = 'pointer';
      }
    } else {
      showToast('数据加载中，请稍后重试', 'info');
      collectAuthorBtn.textContent = '采集创作者';
      collectAuthorBtn.disabled = false;
      collectAuthorBtn.style.opacity = '1';
      collectAuthorBtn.style.cursor = 'pointer';
    }
  });

  fetchFromApiBtn.addEventListener('click', async () => {
    fetchFromApiBtn.textContent = '获取中...';
    fetchFromApiBtn.disabled = true;
    fetchFromApiBtn.style.opacity = '0.6';
    fetchFromApiBtn.style.cursor = 'not-allowed';

    const match = window.location.href.match(/\/(creator|user)\/([\w]+)/);
    const authorId = match?.[2];

    if (!authorId) {
      showToast('无法获取用户ID', 'error');
      fetchFromApiBtn.textContent = 'API获取';
      fetchFromApiBtn.disabled = false;
      fetchFromApiBtn.style.opacity = '1';
      fetchFromApiBtn.style.cursor = 'pointer';
      return;
    }

    try {
      const response = await callPgyApi('GET', '/api/creator/home', { user_id: authorId });

      if (response?.data?.creator) {
        const authorData = extractAuthorData(response.data.creator);
        if (authorData) {
          const saveResponse = await sendMessage('collect:author', {
            platform: 'pgy',
            author: authorData,
          });

          if (saveResponse.success) {
            showToast('已通过API获取并保存', 'success');
            fetchFromApiBtn.textContent = '已获取';
            collectedAuthors.set(authorId, authorData);
          } else {
            showToast('保存失败: ' + saveResponse.error, 'error');
            fetchFromApiBtn.textContent = 'API获取';
            fetchFromApiBtn.disabled = false;
            fetchFromApiBtn.style.opacity = '1';
            fetchFromApiBtn.style.cursor = 'pointer';
          }
        }
      } else {
        showToast('API返回数据为空', 'error');
        fetchFromApiBtn.textContent = 'API获取';
        fetchFromApiBtn.disabled = false;
        fetchFromApiBtn.style.opacity = '1';
        fetchFromApiBtn.style.cursor = 'pointer';
      }
    } catch (e) {
      showToast(`获取异常: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
      fetchFromApiBtn.textContent = 'API获取';
      fetchFromApiBtn.disabled = false;
      fetchFromApiBtn.style.opacity = '1';
      fetchFromApiBtn.style.cursor = 'pointer';
    }
  });

  container.appendChild(buttonsContainer);
  injectedUI = buttonsContainer;
}

function injectListPageUI() {
  const selectors = [
    '[class*="note-item"]',
    '[class*="creator-item"]',
    '.list-item',
    '[class*="card"]'
  ];

  const items = document.querySelectorAll(selectors.join(', '));

  items.forEach((item) => {
    if (item.querySelector('.zl-collect-btn')) return;
    if (!(item instanceof HTMLElement)) return;

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

async function callPgyApi(method: string, path: string, params?: Record<string, any>): Promise<any> {
  return new Promise((resolve, reject) => {
    const requestId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    let isResponded = false;

    const cleanup = () => {
      window.removeEventListener('message', handleResponse);
      window.removeEventListener('message', handleError);
      if (timeoutId) clearTimeout(timeoutId);
    };

    const timeoutId = setTimeout(() => {
      if (!isResponded) {
        cleanup();
        reject(new Error('API 请求超时'));
        isResponded = true;
      }
    }, 30000);

    const handleResponse = (event: MessageEvent) => {
      if (event.data?.type === 'zl_pgy_api_response' &&
          event.data?.requestId === requestId &&
          event.data?.source === 'main') {
        if (!isResponded) {
          cleanup();
          resolve(event.data.response);
          isResponded = true;
        }
      }
    };

    const handleError = (event: MessageEvent) => {
      if (event.data?.type === 'zl_pgy_api_error' &&
          event.data?.requestId === requestId &&
          event.data?.source === 'main') {
        if (!isResponded) {
          cleanup();
          reject(new Error(event.data.error));
          isResponded = true;
        }
      }
    };

    window.addEventListener('message', handleResponse);
    window.addEventListener('message', handleError);

    window.postMessage({
      type: 'zl_pgy_api_request',
      requestId,
      source: 'isolated',
      method,
      path,
      params,
    }, '*');
  });
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

function showBatchInviteModal() {
  const existingModal = document.querySelector('.zl-invite-modal');
  if (existingModal) {
    existingModal.remove();
    return;
  }

  const modal = document.createElement('div');
  const shadow = modal.attachShadow({ mode: 'open' });
  modal.className = 'zl-invite-modal';

  let currentStep = 0;
  let inviteLinks = '';
  let inviteResult = { success: 0, fail: 0, remainTimes: 0, errorList: [] as any[] };
  let brandList: any[] = [];
  let selectedBrand: any = null;
  let userInfo: any = null;

  const render = () => {
    shadow.innerHTML = `
      <style>
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5);
          z-index: 9999999;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .modal-content {
          background: white;
          border-radius: 12px;
          padding: 24px;
          width: 520px;
          max-width: 90vw;
          max-height: 80vh;
          overflow-y: auto;
        }
        .modal-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 16px;
          color: #333;
        }
        .modal-desc {
          font-size: 14px;
          color: #666;
          margin-bottom: 16px;
          line-height: 1.6;
        }
        .input-group {
          margin-bottom: 16px;
        }
        .input-group label {
          display: block;
          font-size: 14px;
          color: #333;
          margin-bottom: 8px;
          font-weight: 500;
        }
        .input-group label .required {
          color: #ef4444;
          margin-left: 2px;
        }
        .input-group textarea,
        .input-group input,
        .input-group select {
          width: 100%;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 14px;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }
        .input-group textarea:focus,
        .input-group input:focus,
        .input-group select:focus {
          outline: none;
          border-color: #8b5cf6;
        }
        .input-group textarea {
          height: 120px;
          resize: vertical;
        }
        .radio-group {
          display: flex;
          gap: 16px;
          margin-top: 4px;
        }
        .radio-group label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          color: #333;
          cursor: pointer;
        }
        .date-range {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .date-range input {
          flex: 1;
        }
        .date-range span {
          color: #999;
        }
        .btn-group {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 20px;
        }
        button {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }
        .btn-cancel {
          background: #f3f4f6;
          color: #666;
        }
        .btn-cancel:hover {
          background: #e5e7eb;
        }
        .btn-primary {
          background: #8b5cf6;
          color: white;
        }
        .btn-primary:hover {
          background: #7c3aed;
        }
        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn-success {
          background: #22c55e;
          color: white;
        }
        .btn-success:hover {
          background: #16a34a;
        }
        .btn-danger {
          background: #ef4444;
          color: white;
        }
        .brand-dropdown {
          position: relative;
        }
        .brand-list {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          max-height: 200px;
          overflow-y: auto;
          z-index: 10;
          margin-top: 4px;
        }
        .brand-item {
          padding: 8px 12px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .brand-item:hover {
          background: #f3f4f6;
        }
        .brand-item img {
          width: 24px;
          height: 24px;
          border-radius: 4px;
        }
        .step-indicator {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }
        .step-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ddd;
        }
        .step-dot.active {
          background: #8b5cf6;
        }
        .step-dot.done {
          background: #22c55e;
        }
        .progress-bar {
          width: 100%;
          height: 6px;
          background: #f3f4f6;
          border-radius: 3px;
          margin: 16px 0;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: #8b5cf6;
          border-radius: 3px;
          transition: width 0.3s;
        }
        .result-stats {
          display: flex;
          gap: 16px;
          margin: 16px 0;
        }
        .result-stat {
          flex: 1;
          text-align: center;
          padding: 12px;
          border-radius: 8px;
          background: #f9fafb;
        }
        .result-stat .number {
          font-size: 24px;
          font-weight: 600;
        }
        .result-stat .label {
          font-size: 12px;
          color: #666;
          margin-top: 4px;
        }
        .result-stat.success .number { color: #22c55e; }
        .result-stat.fail .number { color: #ef4444; }
        .result-stat.remain .number { color: #8b5cf6; }
        .error-list {
          margin-top: 12px;
          max-height: 200px;
          overflow-y: auto;
        }
        .error-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #fef2f2;
          border-radius: 6px;
          margin-bottom: 6px;
          font-size: 13px;
        }
        .error-item .name { color: #333; font-weight: 500; }
        .error-item .reason { color: #ef4444; }
        .tooltip-hint {
          font-size: 12px;
          color: #999;
          margin-top: 4px;
        }
        .link-example {
          font-size: 12px;
          color: #8b5cf6;
          cursor: pointer;
          text-decoration: underline;
        }
        .warning-text {
          font-size: 12px;
          color: #f59e0b;
          margin-top: 8px;
        }
        .loading-spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid #ddd;
          border-top-color: #8b5cf6;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          margin-right: 8px;
          vertical-align: middle;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
      <div class="modal-overlay">
        <div class="modal-content" id="modalContent"></div>
      </div>
    `;

    const content = shadow.querySelector('#modalContent') as HTMLDivElement;
    const overlay = shadow.querySelector('.modal-overlay') as HTMLDivElement;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) modal.remove();
    });

    if (currentStep === 0) {
      renderStep0(content);
    } else if (currentStep === 1) {
      renderStep1(content);
    } else if (currentStep === 2) {
      renderStep2(content);
    } else if (currentStep === 3) {
      renderStep3(content);
    }
  };

  const renderStep0 = (content: HTMLDivElement) => {
    content.innerHTML = `
      <div class="modal-title">批量邀约</div>
      <div class="step-indicator">
        <div class="step-dot active"></div>
        <div class="step-dot"></div>
        <div class="step-dot"></div>
      </div>
      <div class="modal-desc">请输入博主的蒲公英主页链接或小红书主页链接</div>
      <div class="input-group">
        <label>博主链接<span class="required">*</span></label>
        <textarea id="linksInput" placeholder="每行一个链接，例如：&#10;https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/xxx&#10;https://www.xiaohongshu.com/user/profile/xxx">${inviteLinks}</textarea>
        <div class="tooltip-hint">
          支持的链接格式：
          <span class="link-example" id="showExample">查看链接规范</span>
        </div>
        <div id="exampleBox" style="display:none; margin-top:8px; padding:10px; background:#f9fafb; border-radius:6px; font-size:12px; color:#666; line-height:1.8;">
          小红书主页链接：https://www.xiaohongshu.com/user/profile/6046f31e000000000101c4af<br>
          蒲公英主页链接：https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/58b549b482ec393a3ffeb093
        </div>
      </div>
      <div class="warning-text">⚠️ 请注意：由于平台限制每日的数据访问量，频繁使用该功能可能会失败</div>
      <div class="btn-group">
        <button class="btn-cancel" id="cancelBtn">取消</button>
        <button class="btn-primary" id="nextBtn">下一步</button>
      </div>
    `;

    const linksInput = content.querySelector('#linksInput') as HTMLTextAreaElement;
    const showExample = content.querySelector('#showExample') as HTMLSpanElement;
    const exampleBox = content.querySelector('#exampleBox') as HTMLDivElement;
    const cancelBtn = content.querySelector('#cancelBtn') as HTMLButtonElement;
    const nextBtn = content.querySelector('#nextBtn') as HTMLButtonElement;

    showExample.addEventListener('click', () => {
      exampleBox.style.display = exampleBox.style.display === 'none' ? 'block' : 'none';
    });

    cancelBtn.addEventListener('click', () => modal.remove());

    nextBtn.addEventListener('click', async () => {
      inviteLinks = linksInput.value.trim();
      if (!inviteLinks) {
        showToast('请输入至少一个博主链接', 'error');
        return;
      }

      nextBtn.textContent = '检查中...';
      nextBtn.disabled = true;

      try {
        const response = await callPgyApi('GET', '/api/solar/user/info');
        if (response?.data) {
          userInfo = response.data;
        }
      } catch (e) {
        console.warn('[智联AI] 获取蒲公英用户信息失败:', e);
      }

      currentStep = 1;
      render();
    });
  };

  const renderStep1 = (content: HTMLDivElement) => {
    content.innerHTML = `
      <div class="modal-title">填写邀约信息</div>
      <div class="step-indicator">
        <div class="step-dot done"></div>
        <div class="step-dot active"></div>
        <div class="step-dot"></div>
      </div>
      <div class="input-group">
        <label>品牌名<span class="required">*</span></label>
        <div class="brand-dropdown">
          <input type="text" id="brandInput" placeholder="搜索品牌" autocomplete="off" />
          <div class="brand-list" id="brandList" style="display:none;"></div>
        </div>
        <div id="selectedBrand" style="margin-top:4px; font-size:13px; color:#8b5cf6;"></div>
      </div>
      <div class="input-group">
        <label>合作类型<span class="required">*</span></label>
        <div class="radio-group">
          <label><input type="radio" name="inviteType" value="1" checked /> 图文笔记一口价</label>
          <label><input type="radio" name="inviteType" value="2" /> 视频笔记一口价</label>
        </div>
      </div>
      <div class="input-group">
        <label>产品名称<span class="required">*</span></label>
        <input type="text" id="productName" placeholder="请输入产品名称" />
      </div>
      <div class="input-group">
        <label>期望发布时间<span class="required">*</span></label>
        <div class="date-range">
          <input type="date" id="dateStart" />
          <span>至</span>
          <input type="date" id="dateEnd" />
        </div>
      </div>
      <div class="input-group">
        <label>合作内容介绍<span class="required">*</span></label>
        <textarea id="inviteContent" placeholder="请简要描述合作内容" style="height:80px;"></textarea>
      </div>
      <div class="input-group">
        <label>联系方式<span class="required">*</span></label>
        <div class="radio-group" style="margin-bottom:8px;">
          <label><input type="radio" name="contactType" value="2" checked /> 微信</label>
          <label><input type="radio" name="contactType" value="1" /> 手机号</label>
        </div>
        <input type="text" id="contactInfo" placeholder="请输入联系方式" />
      </div>
      <div class="btn-group">
        <button class="btn-cancel" id="cancelBtn">取消</button>
        <button class="btn-primary" id="confirmBtn">确认邀约</button>
      </div>
    `;

    const brandInput = content.querySelector('#brandInput') as HTMLInputElement;
    const brandListEl = content.querySelector('#brandList') as HTMLDivElement;
    const selectedBrandEl = content.querySelector('#selectedBrand') as HTMLDivElement;
    const confirmBtn = content.querySelector('#confirmBtn') as HTMLButtonElement;
    const cancelBtn = content.querySelector('#cancelBtn') as HTMLButtonElement;

    if (selectedBrand) {
      selectedBrandEl.textContent = `已选择: ${selectedBrand.brandName || selectedBrand.name}`;
      brandInput.value = selectedBrand.brandName || selectedBrand.name || '';
    }

    let searchTimer: ReturnType<typeof setTimeout> | null = null;
    brandInput.addEventListener('input', () => {
      if (searchTimer) clearTimeout(searchTimer);
      const keyword = brandInput.value.trim();
      if (!keyword) {
        brandListEl.style.display = 'none';
        return;
      }
      searchTimer = setTimeout(async () => {
        try {
          const response = await callPgyApi('GET', `/api/solar/brand/search_brand?name=${encodeURIComponent(keyword)}&pageSize=20`);
          brandList = response?.data?.list || response?.list || [];
          if (brandList.length > 0) {
            brandListEl.innerHTML = brandList.map((b: any) =>
              `<div class="brand-item" data-id="${b.brandId}">${b.brandLogo ? `<img src="${b.brandLogo}" />` : ''}${b.brandName}</div>`
            ).join('');
            brandListEl.style.display = 'block';

            brandListEl.querySelectorAll('.brand-item').forEach(item => {
              item.addEventListener('click', () => {
                const id = (item as HTMLElement).dataset.id;
                selectedBrand = brandList.find((b: any) => String(b.brandId) === id);
                brandInput.value = selectedBrand?.brandName || '';
                selectedBrandEl.textContent = `已选择: ${selectedBrand?.brandName || ''}`;
                brandListEl.style.display = 'none';
              });
            });
          } else {
            brandListEl.innerHTML = '<div class="brand-item" style="color:#999;">未找到品牌</div>';
            brandListEl.style.display = 'block';
          }
        } catch (e) {
          console.warn('[智联AI] 搜索品牌失败:', e);
        }
      }, 500);
    });

    document.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.brand-dropdown')) {
        brandListEl.style.display = 'none';
      }
    });

    cancelBtn.addEventListener('click', () => modal.remove());

    confirmBtn.addEventListener('click', async () => {
      const inviteType = (content.querySelector('input[name="inviteType"]:checked') as HTMLInputElement)?.value;
      const contactType = (content.querySelector('input[name="contactType"]:checked') as HTMLInputElement)?.value;
      const productName = (content.querySelector('#productName') as HTMLInputElement).value.trim();
      const dateStart = (content.querySelector('#dateStart') as HTMLInputElement).value;
      const dateEnd = (content.querySelector('#dateEnd') as HTMLInputElement).value;
      const inviteContent = (content.querySelector('#inviteContent') as HTMLTextAreaElement).value.trim();
      const contactInfo = (content.querySelector('#contactInfo') as HTMLInputElement).value.trim();

      if (!selectedBrand) {
        showToast('请选择品牌', 'error');
        return;
      }
      if (!productName) {
        showToast('请输入产品名称', 'error');
        return;
      }
      if (!dateStart || !dateEnd) {
        showToast('请选择期望发布时间', 'error');
        return;
      }
      if (!inviteContent) {
        showToast('请输入合作内容介绍', 'error');
        return;
      }
      if (!contactInfo) {
        showToast('请输入联系方式', 'error');
        return;
      }

      confirmBtn.textContent = '检查中...';
      confirmBtn.disabled = true;

      const kolIds = parseKolIds(inviteLinks);

      if (kolIds.length === 0) {
        showToast('未识别到有效的博主ID', 'error');
        confirmBtn.textContent = '确认邀约';
        confirmBtn.disabled = false;
        return;
      }

      const inviteData = {
        cooperateBrandName: selectedBrand.brandName,
        cooperateBrandId: selectedBrand.brandId,
        productName,
        inviteType: Number(inviteType),
        expectedPublishTimeStart: dateStart,
        expectedPublishTimeEnd: dateEnd,
        inviteContent,
        contactType: Number(contactType),
        contactInfo,
        brandUserId: userInfo?.userId,
      };

      currentStep = 2;
      render();

      await executeBatchInvite(kolIds, inviteData);
    });
  };

  const renderStep2 = (content: HTMLDivElement) => {
    content.innerHTML = `
      <div class="modal-title">批量邀约进行中</div>
      <div class="step-indicator">
        <div class="step-dot done"></div>
        <div class="step-dot done"></div>
        <div class="step-dot active"></div>
      </div>
      <div style="text-align:center; padding: 20px 0;">
        <span class="loading-spinner"></span>
        <span style="color:#666;">正在邀约中，请勿关闭此窗口...</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" id="progressFill" style="width: 0%;"></div>
      </div>
      <div style="text-align:center; font-size:14px; color:#666;" id="progressText">0 / 0</div>
    `;
  };

  const renderStep3 = (content: HTMLDivElement) => {
    const hasError = inviteResult.fail > 0;
    content.innerHTML = `
      <div class="modal-title">${hasError ? '批量邀约已完成' : '邀约成功'}</div>
      <div class="step-indicator">
        <div class="step-dot done"></div>
        <div class="step-dot done"></div>
        <div class="step-dot done"></div>
      </div>
      <div class="result-stats">
        <div class="result-stat success">
          <div class="number">${inviteResult.success}</div>
          <div class="label">邀约成功</div>
        </div>
        <div class="result-stat fail">
          <div class="number">${inviteResult.fail}</div>
          <div class="label">邀约失败</div>
        </div>
        <div class="result-stat remain">
          <div class="number">${inviteResult.remainTimes}</div>
          <div class="label">剩余次数</div>
        </div>
      </div>
      ${hasError ? `
        <div style="font-size:14px; color:#333; margin: 12px 0 8px; font-weight:500;">失败列表：</div>
        <div class="error-list">
          ${inviteResult.errorList.map((item: any) => `
            <div class="error-item">
              <span class="name">${item.name || item.id}</span>
              <span class="reason">${item.reason}</span>
              <a href="${item.url}" target="_blank" style="color:#8b5cf6; font-size:12px; margin-left:auto;">查看</a>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <div class="btn-group">
        ${hasError ? `<button class="btn-danger" id="downloadErrors">下载失败记录</button>` : ''}
        <a href="https://pgy.xiaohongshu.com/solar/pre-trade_v2/brand/my-invite-list" target="_blank"
           style="padding:10px 20px; background:#06b6d4; color:white; border-radius:8px; text-decoration:none; font-size:14px; font-weight:500;">
          查看邀约记录
        </a>
        <button class="btn-cancel" id="closeBtn">关闭</button>
      </div>
    `;

    const closeBtn = content.querySelector('#closeBtn') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => modal.remove());

    const downloadErrors = content.querySelector('#downloadErrors') as HTMLButtonElement;
    if (downloadErrors) {
      downloadErrors.addEventListener('click', () => {
        const csvHeader = 'ID,名称,失败原因,链接\n';
        const csvBody = inviteResult.errorList.map((item: any) =>
          [item.id, item.name, item.reason, item.url].join(',')
        ).join('\n');
        const csvContent = csvHeader + csvBody;
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `邀约失败记录_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('下载成功', 'success');
      });
    }
  };

  const parseKolIds = (links: string): string[] => {
    const lines = links.split('\n').filter(l => l.trim());
    const ids: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim().split('?')[0];
      const pgyMatch = trimmed.match(/\/blogger-detail\/([\w]+)/);
      const xhsMatch = trimmed.match(/\/user\/profile\/([\w]+)/);
      const creatorMatch = trimmed.match(/\/(creator|user)\/([\w]+)/);
      if (pgyMatch) {
        ids.push(pgyMatch[1]);
      } else if (xhsMatch) {
        ids.push(xhsMatch[1]);
      } else if (creatorMatch) {
        ids.push(creatorMatch[2]);
      }
    }
    return [...new Set(ids)];
  };

  const executeBatchInvite = async (kolIds: string[], inviteData: any) => {
    inviteResult = { success: 0, fail: 0, remainTimes: 0, errorList: [] };
    let remainTimes = 0;

    try {
      const checkResp = await callPgyApi('GET', `/api/solar/invite/check_invite_permission?kol_id=${kolIds[0]}`);
      remainTimes = checkResp?.data?.brandRemainTimes ?? checkResp?.brandRemainTimes ?? 0;
    } catch (e) {
      console.warn('[智联AI] 检查邀约权限失败:', e);
    }

    const progressFill = shadow.querySelector('#progressFill') as HTMLDivElement;
    const progressText = shadow.querySelector('#progressText') as HTMLDivElement;

    for (let i = 0; i < kolIds.length; i++) {
      const kolId = kolIds[i];

      if (progressFill) {
        const pct = Math.round(((i + 1) / kolIds.length) * 100);
        progressFill.style.width = pct + '%';
      }
      if (progressText) {
        progressText.textContent = `${i + 1} / ${kolIds.length}`;
      }

      try {
        const inviteResp = await callPgyApi('POST', '/api/solar/invite/initiate_invite', {
          kolId,
          ...inviteData,
        });

        if (inviteResp?.data?.inviteSucceed || inviteResp?.inviteSucceed) {
          inviteResult.success++;
        } else {
          const hint = inviteResp?.data?.hint || inviteResp?.hint || '未知异常';
          throw new Error(hint);
        }

        try {
          await callPgyApi('POST', '/api/solar/invite/get_invites_overview', {
            kolIntention: -1,
            inviteStatus: -1,
            kolType: 0,
            kolId,
            showWechat: 0,
            searchDateType: 1,
            pageNum: 1,
            pageSize: 10,
          });
        } catch (_) {}

      } catch (err: any) {
        inviteResult.fail++;
        let bloggerName = kolId;
        let bloggerUrl = `https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/${kolId}`;

        try {
          const bloggerResp = await callPgyApi('GET', `/api/solar/cooperator/user/blogger/${kolId}`);
          bloggerName = bloggerResp?.data?.name || bloggerResp?.name || kolId;
        } catch (_) {}

        inviteResult.errorList.push({
          id: kolId,
          name: bloggerName,
          reason: err.message || '邀约失败',
          url: bloggerUrl,
        });
      }

      if (i < kolIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    inviteResult.remainTimes = Math.max(0, remainTimes - inviteResult.success);

    currentStep = 3;
    render();
  };

  render();
  document.body.appendChild(modal);
}

function showInviteRecordsModal() {
  const existingModal = document.querySelector('.zl-records-modal');
  if (existingModal) {
    existingModal.remove();
    return;
  }

  const modal = document.createElement('div');
  const shadow = modal.attachShadow({ mode: 'open' });
  modal.className = 'zl-records-modal';

  shadow.innerHTML = `
    <style>
      .modal-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 9999999;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .modal-content {
        background: white;
        border-radius: 12px;
        padding: 24px;
        width: 900px;
        max-width: 90vw;
        max-height: 80vh;
        overflow-y: auto;
      }
      .modal-title {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 16px;
        color: #333;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .modal-footer {
        font-size: 12px;
        color: #757575;
        margin-top: 12px;
        font-style: normal;
      }
      .modal-footer a {
        color: #8b5cf6;
        text-decoration: none;
      }
      .loading {
        text-align: center;
        padding: 40px;
        color: #666;
      }
      .loading-spinner {
        display: inline-block;
        width: 24px;
        height: 24px;
        border: 3px solid #ddd;
        border-top-color: #8b5cf6;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        margin-top: 12px;
      }
      th {
        background: #f9fafb;
        padding: 10px 8px;
        text-align: center;
        font-weight: 500;
        color: #666;
        border-bottom: 1px solid #eee;
        white-space: nowrap;
      }
      td {
        padding: 10px 8px;
        text-align: center;
        border-bottom: 1px solid #f3f4f6;
        color: #333;
      }
      tr:hover td {
        background: #f9fafb;
      }
      .badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 500;
      }
      .badge-success { background: #dcfce7; color: #16a34a; }
      .badge-error { background: #fef2f2; color: #ef4444; }
      .badge-default { background: #f3f4f6; color: #666; }
      .badge-processing { background: #dbeafe; color: #2563eb; }
      .badge-warning { background: #fef3c7; color: #d97706; }
      .copy-link {
        color: #8b5cf6;
        cursor: pointer;
        font-size: 12px;
        text-decoration: none;
        margin-left: 4px;
      }
      .copy-link:hover {
        text-decoration: underline;
      }
      .detail-link {
        color: #8b5cf6;
        text-decoration: none;
        font-size: 12px;
      }
      .detail-link:hover {
        text-decoration: underline;
      }
      .empty-text {
        text-align: center;
        padding: 40px;
        color: #999;
        font-size: 14px;
      }
    </style>
    <div class="modal-overlay">
      <div class="modal-content">
        <div class="modal-title">
          <span>邀约记录</span>
          <button id="closeBtn" style="background:none; font-size:20px; color:#999; padding:0 4px; cursor:pointer;">✕</button>
        </div>
        <div id="recordsContent">
          <div class="loading">
            <span class="loading-spinner"></span>
            <div style="margin-top:12px;">加载中...</div>
          </div>
        </div>
        <div class="modal-footer">
          信息来源于
          <a href="https://pgy.xiaohongshu.com/solar/pre-trade/brand/invite-list/note" target="_blank">【我的邀约】</a>
        </div>
      </div>
    </div>
  `;

  const closeBtn = shadow.querySelector('#closeBtn') as HTMLButtonElement;
  const overlay = shadow.querySelector('.modal-overlay') as HTMLDivElement;
  const recordsContent = shadow.querySelector('#recordsContent') as HTMLDivElement;

  closeBtn.addEventListener('click', () => modal.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) modal.remove();
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast('复制成功', 'success');
    }).catch(() => {
      showToast('复制失败', 'error');
    });
  };

  const loadRecords = async () => {
    try {
      const response = await callPgyApi('POST', '/api/solar/invite/get_invites_overview', {
        kolIntention: -1,
        inviteStatus: -1,
        kolType: 0,
        showWechat: 1,
        searchDateType: 1,
        pageNum: 1,
        pageSize: 50,
      });

      const records = response?.data?.list || response?.list || [];

      if (records.length === 0) {
        recordsContent.innerHTML = '<div class="empty-text">暂无邀约记录</div>';
        return;
      }

      recordsContent.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>品牌名</th>
              <th>产品名称</th>
              <th>邀约发起时间</th>
              <th>邀约回复时间</th>
              <th>合作类型</th>
              <th>合作价格</th>
              <th>邀约状态</th>
              <th>博主微信</th>
              <th>手机号</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((r: any) => `
              <tr>
                <td>${r.cooperateBrandName || '-'}</td>
                <td>${r.productName || '-'}</td>
                <td>${r.inviteCreateTime ? new Date(r.inviteCreateTime).toLocaleString('zh-CN') : '-'}</td>
                <td>${r.inviteReplyTime ? new Date(r.inviteReplyTime).toLocaleString('zh-CN') : '-'}</td>
                <td>${r.inviteType === 1
                  ? '<span class="badge badge-processing">图文笔记</span>'
                  : '<span class="badge badge-warning">视频笔记</span>'
                }</td>
                <td>${r.notePrice ? '¥' + String(r.notePrice).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '-'}</td>
                <td>${
                  r.kolIntention === 1 ? '<span class="badge badge-success">感兴趣</span>' :
                  r.kolIntention === 2 ? '<span class="badge badge-error">暂不考虑</span>' :
                  '<span class="badge badge-default">未回复</span>'
                }</td>
                <td>${r.wechatNo
                  ? `${r.wechatNo} <span class="copy-link" data-copy="${r.wechatNo}">复制</span>`
                  : '-'
                }</td>
                <td>${r.phoneNo
                  ? `${r.phoneNo} <span class="copy-link" data-copy="${r.phoneNo}">复制</span>`
                  : '-'
                }</td>
                <td><a class="detail-link" href="https://pgy.xiaohongshu.com/solar/pre-trade/invite-detail?id=${r.inviteId}" target="_blank">邀约详情</a></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      recordsContent.querySelectorAll('.copy-link').forEach(el => {
        el.addEventListener('click', () => {
          const text = (el as HTMLElement).dataset.copy || '';
          copyToClipboard(text);
        });
      });

    } catch (e) {
      console.error('[智联AI] 获取邀约记录失败:', e);
      recordsContent.innerHTML = '<div class="empty-text">加载失败，请确保已登录蒲公英平台</div>';
    }
  };

  loadRecords();
  document.body.appendChild(modal);
}

function handleApprove(approved: boolean) {
  const url = window.location.href;

  if (!url.includes('pgy.xiaohongshu.com')) {
    showToast('请在蒲公英页面使用此功能', 'error');
    return;
  }

  const detailMatch = url.match(/\/blogger-detail\/([\w]+)/);
  if (!detailMatch) {
    showToast('请在博主详情页使用审核功能', 'info');
    return;
  }

  const kolId = detailMatch[1];
  const action = approved ? '通过' : '拒绝';

  showToast(`已标记为审核${action}: ${kolId}`, approved ? 'success' : 'info');

  sendMessage('collect:author', {
    platform: 'pgy',
    author: {
      platform: 'pgy',
      authorId: kolId,
      reviewStatus: approved ? 'approved' : 'rejected',
      reviewedAt: new Date().toISOString(),
    },
  });
}

function removeInjectedUI() {
  if (injectedUI) {
    injectedUI.remove();
    injectedUI = null;
  }

  document.querySelectorAll('.zl-collect-btn').forEach(el => el.remove());
  document.querySelectorAll('.zl-invite-modal').forEach(el => el.remove());
  document.querySelectorAll('.zl-records-modal').forEach(el => el.remove());
}
