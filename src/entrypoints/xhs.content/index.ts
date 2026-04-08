import { sendMessage } from '@/shared/utils/messaging';
import type { PageType } from '@/shared/types';
import type { PostEntity, AuthorEntity, CommentEntity } from '@/shared/types/entities';

// 定义自定义事件的数据结构
interface XHSInterceptEventDetail {
  url: string;
  data: any;
}

let currentPageType: PageType = 'unknown';
let injectedUI: HTMLElement | null = null;

const collectedPosts: Map<string, Partial<PostEntity>> = new Map();
const collectedAuthors: Map<string, Partial<AuthorEntity>> = new Map();
const collectedComments: Map<string, Partial<CommentEntity>> = new Map();

export default defineContentScript({
  matches: ['*://www.xiaohongshu.com/*'],
  runAt: 'document_start',
  // 默认使用 ISOLATED world，以便正常调用 sendMessage
  
  main() {
    console.log('[智联AI] 小红书 ISOLATED world 桥接脚本已加载');
    
    // 注册自定义事件监听，接收来自 MAIN world 拦截器的 CustomEvent
    window.addEventListener('zl_xhs_api_intercepted', (e: Event) => {
      const customEvent = e as CustomEvent<XHSInterceptEventDetail>;
      const { url, data } = customEvent.detail;
      handleApiData(url, data);
    });

    currentPageType = detectXHSPage(window.location.href);
    
    window.addEventListener('load', () => {
      onPageLoaded();
    });
    
    observePageChanges();
  }
});


function handleApiData(url: string, data: any) {
  console.log(url,data,'检测数据')
   if (!data || !data.data) return;
  
  console.log('[智联AI] 拦截到数据:', url.split('?')[0]);
  
  if (url.includes('/api/sns/web/v1/homefeed') || url.includes('/api/sns/web/v1/search/notes') || url.includes('/api/sns/web/v1/feed')) {
    handleFeedData(data);
  } else if (url.includes('/api/sns/web/v1/user_posted')) {
    handleUserPostsData(data);
  } else if (url.includes('/api/sns/web/v2/note/') || url.includes('/api/sns/web/v1/note/')) {
    handleNoteDetailData(data);
  } else if (url.includes('/api/sns/web/v2/user/') || url.includes('/api/sns/web/v1/user/')) {
    console.log(data,99)
    handleUserData(data);
  }
  if (url.includes('/api/sns/web/v2/comment/page')) {
    console.log(data,'评论数据')
    handleCommentData(data);
  }
}

function handleFeedData(data: any) {
  console.log(data,111111)
  const items = data.data?.items || data.data?.notes || [];
  let count = 0;
  
  items.forEach((item: any) => {
    const note = item.note || item.note_card || item;
    const postData = extractPostData(note);
    if (postData?.postId) {
      collectedPosts.set(postData.postId, postData);
      count++;
    }
  });
  
  if (count > 0) {
    // console.log(`[智联AI] 缓存 ${count} 条帖子数据`);
    debouncedSavePosts();
  }
}

function handleUserPostsData(data: any) {
  console.log(data,22222)
  const notes = data.data?.notes || [];
  let count = 0;
  
  notes.forEach((noteItem: any) => {
    const note = noteItem.note || noteItem;
    const postData = extractPostData(note);
    if (postData?.postId) {
      collectedPosts.set(postData.postId, postData);
      count++;
    }
  });
  
  if (count > 0) {
    // console.log(`[智联AI] 缓存用户帖子 ${count} 条`);
    debouncedSavePosts();
  }
}

function handleNoteDetailData(data: any) {
  const note = data.data?.note;
  const postData = extractPostData(note);
  if (postData?.postId) {
    collectedPosts.set(postData.postId, postData);
    console.log(`[智联AI] 缓存帖子详情: ${postData.postId}`);
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

/**
 * 处理评论数据
 * @param data 评论接口返回的数据
 */
function handleCommentData(data: any) {
  const comments = data.data?.comments || [];
  let count = 0;
  console.log(comments,333333)
  comments.forEach((comment: any) => {
    const commentData = extractCommentData(comment);
    if (commentData?.commentId) {
      collectedComments.set(commentData.commentId, commentData);
      count++;
    }
    
    if (comment.sub_comments && Array.isArray(comment.sub_comments)) {
      comment.sub_comments.forEach((subComment: any) => {
        const subCommentData = extractCommentData(subComment);
        if (subCommentData?.commentId) {
          collectedComments.set(subCommentData.commentId, subCommentData);
          count++;
        }
      });
    }
  });
  
  if (count > 0) {
    console.log(`[智联AI] 缓存 ${count} 条评论数据`);
    debouncedSaveComments();
  }
}

/**
 * 从评论数据中提取评论实体
 * @param comment 原始评论数据
 * @returns 部分评论实体或 null
 */
function extractCommentData(comment: any): Partial<CommentEntity> | null {
  if (!comment?.id) return null;
  
  const userInfo = comment.user_info || {};
  const createTime = comment.create_time;
  
  return {
    platform: 'xhs',
    commentId: comment.id,
    postId: comment.note_id,
    authorId: userInfo.user_id,
    authorName: userInfo.nickname,
    authorAvatar: userInfo.image,
    content: comment.content || '',
    likeCount: parseLikeCount(comment.like_count),
    replyCount: parseLikeCount(comment.sub_comment_count),
    publishTime: createTime ? new Date(createTime).toISOString() : undefined,
    sourcePageUrl: window.location.href
  };
}

/**
 * 解析点赞数字符串（如 "10+" -> 10）
 * @param value 点赞数值或字符串
 * @returns 数字或 undefined
 */
function parseLikeCount(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const num = parseInt(value.replace(/[^\d]/g, ''), 10);
    return Number.isFinite(num) ? num : undefined;
  }
  return undefined;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function sanitizeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const s = value.trim().replace(/`/g, '');
  return s ? s : undefined;
}

function normalizeXhsUser(raw: any): { userId?: string; nickname?: string; name?: string; avatar?: string } {
  if (!raw || typeof raw !== 'object') return {};
  return {
    userId: raw.userId ?? raw.user_id ?? raw.id,
    nickname: raw.nickname ?? raw.nick_name,
    name: raw.name,
    avatar: raw.avatar ?? raw.image,
  };
}

function normalizeXhsInteractInfo(raw: any): {
  likeCount?: number;
  commentCount?: number;
  collectCount?: number;
  shareCount?: number;
} {
  if (!raw || typeof raw !== 'object') return {};
  return {
    likeCount: toNumber(raw.likeCount ?? raw.liked_count ?? raw.likedCount),
    commentCount: toNumber(raw.commentCount ?? raw.comment_count ?? raw.commentCount),
    collectCount: toNumber(raw.collectCount ?? raw.collect_count ?? raw.collected_count ?? raw.collectCount),
    shareCount: toNumber(raw.shareCount ?? raw.share_count ?? raw.shareCount),
  };
}

function normalizeXhsNote(input: any): any | null {
  if (!input || typeof input !== 'object') return null;

  const wrapper = input;
  const card = wrapper.note_card ?? wrapper.noteCard;
  const base = wrapper.note ?? wrapper;
  const merged = card && typeof card === 'object' ? { ...base, ...card } : base;

  const noteId = merged.noteId ?? merged.note_id ?? wrapper.noteId ?? wrapper.note_id ?? wrapper.id ?? merged.id;
  if (!noteId) return null;

  return {
    ...merged,
    noteId,
    user: merged.user ?? card?.user ?? wrapper.user,
    interactInfo: merged.interactInfo ?? merged.interact_info ?? card?.interactInfo ?? card?.interact_info,
    cover: merged.cover ?? card?.cover,
    displayTitle: merged.displayTitle ?? merged.display_title,
  };
}

function extractPostData(note: any): Partial<PostEntity> | null {
  const normalizedNote = normalizeXhsNote(note);
  if (!normalizedNote?.noteId) return null;

  const user = normalizeXhsUser(normalizedNote.user);
  const interactInfo = normalizeXhsInteractInfo(normalizedNote.interactInfo);
  const cover = normalizedNote.cover || {};
  const imageList = normalizedNote.imageList || normalizedNote.image_list || [];
  const title = normalizedNote.title || normalizedNote.displayTitle || normalizedNote.display_title || '';
  const coverUrl =
    sanitizeUrl(imageList?.[0]?.urlDefault ?? imageList?.[0]?.url_default) ||
    sanitizeUrl(cover?.urlDefault ?? cover?.url_default) ||
    sanitizeUrl(cover?.urlPre ?? cover?.url_pre) ||
    sanitizeUrl(cover?.infoList?.find((x: any) => x?.image_scene === 'WB_DFT')?.url) ||
    sanitizeUrl(cover?.info_list?.find((x: any) => x?.image_scene === 'WB_DFT')?.url);
  
  const postData = {
    platform: 'xhs' as const,
    postId: normalizedNote.noteId,
    postType: (normalizedNote.type === 'video' ? 'video' : 'image') as any,
    title,
    content: normalizedNote.desc || normalizedNote.content || '',
    url: `https://www.xiaohongshu.com/explore/${normalizedNote.noteId}`,
    coverUrl,
    publishTime: normalizedNote.time ? new Date(normalizedNote.time).toISOString() : undefined,
    authorId: user.userId,
    authorName: user.nickname || user.name,
    authorUrl: user.userId ? `https://www.xiaohongshu.com/user/profile/${user.userId}` : undefined,
    likeCount: interactInfo.likeCount,
    commentCount: interactInfo.commentCount,
    collectCount: interactInfo.collectCount,
    shareCount: interactInfo.shareCount,
    mediaCount: imageList?.length || (normalizedNote.video ? 1 : 0),
    tags: normalizedNote.tagList?.map((t: any) => t.name || t) || [],
    sourcePageUrl: window.location.href,
    sourcePageType: 'feed_list' as const
  };

  // console.log(`[智联AI] 提取帖子数据成功 (${postData.postId}):`, postData);
  return postData;
}

function extractAuthorData(user: any): Partial<AuthorEntity> | null {
  if (!user?.userId) return null;
  
  const authorData = {
    platform: 'xhs' as const,
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

  console.log(`[智联AI] 提取作者数据成功 (${authorData.authorId}):`, authorData);
  return authorData;
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

let saveCommentsTimer: ReturnType<typeof setTimeout> | null = null;
/**
 * 防抖保存评论数据
 */
function debouncedSaveComments() {
  if (saveCommentsTimer) {
    clearTimeout(saveCommentsTimer);
  }
  saveCommentsTimer = setTimeout(() => {
    if (collectedComments.size > 0) {
      sendMessage('cache:comments', { comments: Array.from(collectedComments.values()) });
    }
    saveCommentsTimer = null;
  }, 1000);
}

function onPageLoaded() {
  console.log('[智联AI] 页面加载完成:', currentPageType,43243);
  
  const state = (window as any).__INITIAL_STATE__;
  console.log('[智联AI] __INITIAL_STATE__:', state);
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
  console.log('[智联AI] 从页面状态提取用户信息:', state);
  const userInfo = state?.user?.userPageInfo || state?.userPageInfo;
  console.log('[智联AI] 提取到的 userInfo:', userInfo);
  
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
      
      currentPageType = newPageType;
      onPageChanged(newPageType);
    }
  });
  
  observer.observe(document.documentElement || document, { childList: true, subtree: true });
}

function onPageChanged(pageType: PageType) {
  console.log('[智联AI] 页面切换:', pageType);
  
  // 尝试在页面切换时也重新获取一次 state
  setTimeout(() => {
    const state = (window as any).__INITIAL_STATE__;
    if (state) {
      if (pageType === 'post_detail') {
        extractPostFromState(state);
      } else if (pageType === 'author_profile') {
        extractAuthorFromState(state);
      }
    }
  }, 1000);

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
  
  const buttonsWrapper = document.createElement('div');
  const shadow = buttonsWrapper.attachShadow({ mode: 'open' });
  
  shadow.innerHTML = `
    <style>
      .buttons-container {
        display: inline-flex;
        gap: 8px;
        margin-left: 12px;
      }
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
      }
      button:hover {
        background: #e01f3a;
      }
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      button.secondary {
        background: #3b82f6;
      }
      button.secondary:hover {
        background: #2563eb;
      }
    </style>
    <div class="buttons-container">
      <button id="collectPost">采集帖子</button>
      <button id="collectComments" class="secondary">采集评论</button>
    </div>
  `;
  
  const collectPostBtn = shadow.querySelector('#collectPost') as HTMLButtonElement;
  const collectCommentsBtn = shadow.querySelector('#collectComments') as HTMLButtonElement;
  
  collectPostBtn?.addEventListener('click', async () => {
    collectPostBtn.textContent = '采集中...';
    collectPostBtn.disabled = true;
    
    const postId = window.location.pathname.split('/').pop();
    const cachedPost = postId ? collectedPosts.get(postId) : null;
    
    if (cachedPost) {
      const response = await sendMessage('collect:post', {
        platform: 'xhs',
        post: cachedPost
      });
      
      if (response.success) {
        showToast('帖子已保存到本地', 'success');
        collectPostBtn.textContent = '已采集';
      } else {
        showToast('采集失败: ' + response.error, 'error');
        collectPostBtn.textContent = '采集帖子';
        collectPostBtn.disabled = false;
      }
    } else {
      showToast('数据加载中，请稍后重试', 'info');
      collectPostBtn.textContent = '采集帖子';
      collectPostBtn.disabled = false;
    }
  });
  
  collectCommentsBtn?.addEventListener('click', async () => {
    collectCommentsBtn.textContent = '采集中...';
    collectCommentsBtn.disabled = true;
    
    const postId = window.location.pathname.split('/').pop();
    
    if (collectedComments.size > 0) {
      const commentsArray = Array.from(collectedComments.values()).filter(
        c => c.postId === postId
      );
      
      if (commentsArray.length > 0) {
        const response = await sendMessage('collect:comments', {
          platform: 'xhs',
          postId: postId,
          comments: commentsArray
        });
        
        if (response.success) {
          showToast(`已保存 ${commentsArray.length} 条评论`, 'success');
          collectCommentsBtn.textContent = '已采集';
        } else {
          showToast('采集失败: ' + response.error, 'error');
          collectCommentsBtn.textContent = '采集评论';
          collectCommentsBtn.disabled = false;
        }
      } else {
        showToast('暂无评论数据，请滚动页面加载评论', 'info');
        collectCommentsBtn.textContent = '采集评论';
        collectCommentsBtn.disabled = false;
      }
    } else {
      showToast('暂无评论数据，请滚动页面加载评论', 'info');
      collectCommentsBtn.textContent = '采集评论';
      collectCommentsBtn.disabled = false;
    }
  });
  
  container.appendChild(buttonsWrapper);
  injectedUI = buttonsWrapper;
}

function injectAuthorPageUI() {
  const container = document.querySelector('.user-info, .user-side, .user-basic-info');
  if (!container) {
    setTimeout(injectAuthorPageUI, 500);
    return;
  }
  
  const { container: buttonContainer, button } = createCollectButton('采集作者', async () => {
    try {
      button.textContent = '采集中...';
      button.disabled = true;
      
      const authorId = window.location.pathname.split('/').pop();
      const cachedAuthor = authorId ? (collectedAuthors.get(authorId) ?? extractAuthorFromDom(authorId)) : null;
      
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
    } catch (e) {
      showToast(`采集异常: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
      button.textContent = '采集作者';
      button.disabled = false;
    }
  });
  
  container.appendChild(buttonContainer);
  injectedUI = buttonContainer;
}

function extractAuthorFromDom(authorId: string): Partial<AuthorEntity> | null {
  if (!authorId) return null;

  console.log(`[智联AI] 开始从 DOM 提取作者信息, ID: ${authorId}`);
  const nameCandidates = [
    '.user-name',
    '.user-info .name',
    '.user-basic-info .name',
    '[class*="userName"]',
    '[class*="UserName"]',
  ];

  const avatarCandidates = [
    'img.avatar',
    '.user-avatar img',
    '.avatar img',
    '.user-image img',
    '[class*="avatar"] img',
  ];

  const descCandidates = [
    '.user-desc',
    '.user-info .desc',
    '[class*="userDesc"]'
  ];

  // 1. 尝试直接从网页包含的 __INITIAL_STATE__ 标签中暴力提取 JSON（这是最准确的）
  try {
    const scripts = Array.from(document.querySelectorAll('script'));
    const stateScript = scripts.find(s => s.textContent?.includes('window.__INITIAL_STATE__='));
    if (stateScript && stateScript.textContent) {
      const match = stateScript.textContent.match(/window\.__INITIAL_STATE__=({.*?})<\/script>/) || 
                    stateScript.textContent.match(/window\.__INITIAL_STATE__=({.*});?/);
      if (match && match[1]) {
        // 将 undefined 替换为 null 以符合 JSON 格式
        const jsonStr = match[1].replace(/undefined/g, 'null');
        const state = JSON.parse(jsonStr);
        const userInfo = state?.user?.userPageInfo || state?.userPageInfo;
        
        if (userInfo?.basicInfo) {
          console.log('[智联AI] DOM兜底阶段: 成功从 script 标签提取到完整 __INITIAL_STATE__');
          const basicInfo = userInfo.basicInfo;
          const interactions = userInfo.interactions || [];
          const getInteraction = (name: string): number | undefined => {
            const item = interactions.find((i: any) => i.name === name);
            return item?.count;
          };
          
          return {
            platform: 'xhs' as const,
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
        }
      }
    }
  } catch (e) {
    console.warn('[智联AI] 从 script 标签提取状态失败:', e);
  }

  // 2. 如果找不到完整的 JSON 状态，退化为通过网页 HTML 元素来刮取文本
  const name =
    nameCandidates
      .map(sel => document.querySelector(sel)?.textContent?.trim())
      .find(Boolean) || '';

  const avatar =
    avatarCandidates
      .map(sel => (document.querySelector(sel) as HTMLImageElement | null)?.src)
      .find(Boolean);

  const bio = 
    descCandidates
      .map(sel => document.querySelector(sel)?.textContent?.trim())
      .find(Boolean);

  // 提取粉丝、关注、获赞数
  let fansCount, followCount, likedCount;
  const statElements = document.querySelectorAll('.user-interactions > div, [class*="interactions"] > div');
  statElements.forEach(el => {
    const text = el.textContent || '';
    const num = parseFloat(text.replace(/[^0-9.]/g, '')) * (text.includes('万') ? 10000 : 1);
    
    if (text.includes('粉丝')) fansCount = num;
    else if (text.includes('关注')) followCount = num;
    else if (text.includes('获赞') || text.includes('收藏')) likedCount = num;
  });

  const authorData = {
    platform: 'xhs' as const,
    authorId,
    name,
    avatar,
    bio,
    fansCount,
    followCount,
    likedCount,
    profileUrl: `https://www.xiaohongshu.com/user/profile/${authorId}`,
    sourcePageUrl: window.location.href
  };

  console.log(`[智联AI] DOM 提取作者数据成功 (${authorId}):`, authorData);
  return authorData;
}

function injectListPageUI() {
  const posts = document.querySelectorAll<HTMLElement>('.note-item, .feeds-page .note-list > div');
  
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
  
  const button = shadow.querySelector('button') as HTMLButtonElement | null;
  button?.addEventListener('click', onClick);
  
  return {
    container,
    button: button ?? document.createElement('button')
  };
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
