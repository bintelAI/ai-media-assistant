import { onMessage, sendMessage } from '@/shared/utils/messaging';
import { initDB } from '@/shared/db';
import { addPost, updatePost } from '@/shared/db/posts';
import { addAuthor, updateAuthor } from '@/shared/db/authors';
import { addComments } from '@/shared/db/comments';
import { addTask, updateTask } from '@/shared/db/tasks';
import { batchCollectManager } from './batchCollectManager';
import type { Message, MessageResponse, BatchCollectStatusResponse } from '@/shared/types/messages';
import type { PostEntity, AuthorEntity, CommentEntity } from '@/shared/types/entities';

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

async function handleCollectAuthor(data: unknown): Promise<MessageResponse<AuthorEntity>> {
  try {
    const { platform, author } = data as { platform: string; author: Partial<AuthorEntity> };
    
    const authorId = author.authorId;
    let authorData = author;
    
    if (authorId && cachedAuthors.has(authorId)) {
      authorData = { ...cachedAuthors.get(authorId), ...author };
      console.log(`[智联AI] 从缓存获取用户数据: ${authorId}`, authorData);
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
      const id = await addAuthor({
        platform: platform as any,
        authorId: authorData.authorId!,
        name: authorData.name || '',
        avatar: authorData.avatar,
        profileUrl: authorData.profileUrl || '',
        bio: authorData.bio,
        fansCount: authorData.fansCount,
        followCount: authorData.followCount,
        likedCount: authorData.likedCount,
        workCount: authorData.workCount,
        location: authorData.location,
        gender: authorData.gender,
        verified: authorData.verified,
        verifiedDesc: authorData.verifiedDesc,
        contactInfo: authorData.contactInfo,
        sourcePageUrl: authorData.sourcePageUrl || ''
      });

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
      
      try {
        await addAuthor({
          platform: author.platform!,
          authorId: author.authorId,
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
        });
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

    batchCollectManager.startBatchCollect(urls);
    
    return { success: true };
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
