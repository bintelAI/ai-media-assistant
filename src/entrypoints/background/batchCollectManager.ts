import { resolveShortUrls, type ShortUrlResolveResult } from '@/shared/services/shortUrlResolver';
import { addAuthor } from '@/shared/db/authors';
import { addPost } from '@/shared/db/posts';
import { addTask, updateTask } from '@/shared/db/tasks';
import { fetchUserOtherInfo } from '@/shared/services/xhs-user-service';
import { fetchPgyCreatorInfo, fetchPgyPostDetail } from '@/shared/services/pgy-user-service';
import { ChromeStorage } from '@/shared/utils/storage';
import {
  DEFAULT_SETTINGS,
  isBatchCollectSupported,
  PLATFORM_FEATURES,
  SETTINGS_STORAGE_KEY,
  unwrapStoredSettings,
  type StoredAppSettings
} from '@/shared/utils/constants';
import type {
  CollectTask,
  BatchCollectProgress,
  CollectResult,
  BatchCollectConfig,
  ParsedUrl
} from '@/shared/types/batchCollect';
import { DEFAULT_BATCH_COLLECT_CONFIG } from '@/shared/types/batchCollect';
import type { AuthorEntity, PostEntity } from '@/shared/types/entities';

interface BatchCollectStartResult {
  total: number;
  accepted: number;
  skipped: number;
}

export class BatchCollectManager {
  private taskQueue: CollectTask[] = [];
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private currentIndex: number = 0;
  private config: BatchCollectConfig;
  private progress: BatchCollectProgress;
  private taskId: string | null = null;
  private abortController: AbortController | null = null;
  private devMode: boolean = false;
  private skippedBeforeQueue: number = 0;

  constructor(config: Partial<BatchCollectConfig> = {}) {
    this.config = { ...DEFAULT_BATCH_COLLECT_CONFIG, ...config };
    this.progress = this.initProgress();
  }

  private initProgress(): BatchCollectProgress {
    return {
      total: 0,
      current: 0,
      success: 0,
      failed: 0,
      currentUrl: '',
      status: 'idle',
      results: []
    };
  }

  async startBatchCollect(urls: string[]): Promise<BatchCollectStartResult> {
    if (this.isRunning) {
      console.warn('[BatchCollectManager] 已有采集任务在运行');
      throw new Error('已有批量采集任务在运行');
    }

    await this.applySettings();
    this.progress = {
      total: urls.length,
      current: 0,
      success: 0,
      failed: 0,
      currentUrl: '',
      status: 'preparing',
      results: []
    };
    this.notifyProgress();

    console.log('[BatchCollectManager] 检测到短链，开始解析...');
    const resolveResults = await resolveShortUrls(urls);
    console.log('[BatchCollectManager] 短链解析完成', resolveResults.length, '个URL');

    const validResolveResults = resolveResults.filter((r): r is ShortUrlResolveResult & { parsed: ParsedUrl } =>
      r.success && r.parsed !== undefined && r.parsed.id !== ''
    );

    const unsupportedResults = validResolveResults.filter((r) => !this.canUseApiCollect(r.parsed));
    const supportedResolveResults = validResolveResults.filter((r) => this.canUseApiCollect(r.parsed));

    if (supportedResolveResults.length === 0) {
      console.warn('[BatchCollectManager] 没有可采集的URL');
      this.progress = {
        total: urls.length,
        current: 0,
        success: 0,
        failed: urls.length,
        currentUrl: '',
        status: 'error',
        results: urls.map((url) => ({
          success: false,
          url,
          error: '无法解析或暂不支持该URL'
        }))
      };
      this.notifyProgress();
      return { total: urls.length, accepted: 0, skipped: urls.length };
    }

    const parsedUrls = supportedResolveResults.map(r => r.parsed as ParsedUrl);

    this.taskQueue = parsedUrls.map(parsed => ({
      url: parsed.originalUrl,
      parsed,
      status: 'pending' as const,
      retryCount: 0
    }));

    this.isRunning = true;
    this.isPaused = false;
    this.currentIndex = 0;
    this.skippedBeforeQueue = unsupportedResults.length;
    this.progress = {
      total: this.taskQueue.length + this.skippedBeforeQueue,
      current: this.skippedBeforeQueue,
      success: 0,
      failed: 0,
      currentUrl: '',
      status: 'running',
      results: unsupportedResults.map((result) => ({
        success: false,
        url: result.originalUrl,
        error: this.getUnsupportedReason(result.parsed)
      }))
    };
    this.progress.failed = unsupportedResults.length;

    this.abortController = new AbortController();

    this.taskId = await addTask({
      taskType: 'collect_post',
      title: `URL批量采集 (${this.taskQueue.length}个)`,
      status: 'running',
      totalCount: this.progress.total,
      failedCount: this.skippedBeforeQueue
    });

    console.log(`[BatchCollectManager] 开始批量采集，共 ${this.taskQueue.length} 个URL`);
    this.notifyProgress();

    this.processQueue().catch((error) => {
      console.error('[BatchCollectManager] 队列执行失败:', error);
      this.progress.status = 'error';
      this.progress.currentUrl = '';
      this.notifyProgress();
    });

    return {
      total: urls.length,
      accepted: this.taskQueue.length,
      skipped: urls.length - this.taskQueue.length
    };
  }

  private async processQueue(): Promise<void> {
    while (this.isRunning && this.currentIndex < this.taskQueue.length) {
      if (this.abortController?.signal.aborted) {
        break;
      }

      if (this.isPaused) {
        await this.sleep(1000);
        continue;
      }

      const task = this.taskQueue[this.currentIndex];
      task.status = 'running';
      this.progress.currentUrl = task.url;
      this.progress.current = this.skippedBeforeQueue + this.currentIndex + 1;
      this.notifyProgress();

      try {
        const result = await this.collectTask(task);

        if (result.success) {
          task.status = 'success';
          task.data = result.data;
          this.progress.success++;
        } else {
          task.status = 'failed';
          task.error = result.error;
          this.progress.failed++;
        }

        this.progress.results.push(result);
      } catch (error) {
        task.status = 'failed';
        task.error = error instanceof Error ? error.message : '未知错误';
        this.progress.failed++;
        this.progress.results.push({
          success: false,
          url: task.url,
          error: task.error
        });
      }

      this.notifyProgress();

      if (this.currentIndex < this.taskQueue.length - 1) {
        const interval = this.getRandomInterval();
        console.log(`[BatchCollectManager] 等待 ${interval}ms 后继续下一个任务`);
        await this.sleep(interval);
      }

      this.currentIndex++;
    }

    await this.completeBatchCollect();
  }

  private async collectTask(task: CollectTask): Promise<CollectResult> {
    const { platform, pageType } = task.parsed;

    if (platform === 'xhs' && pageType === 'author_profile') {
      return this.collectXhsAuthor(task);
    }

    if (platform === 'pgy' && pageType === 'author_profile') {
      return this.collectPgyAuthor(task);
    }

    if (platform === 'pgy' && pageType === 'post_detail') {
      return this.collectPgyPost(task);
    }

    return {
      success: false,
      url: task.url,
      error: this.getUnsupportedReason(task.parsed)
    };
  }

  private canUseApiCollect(parsed: ParsedUrl): boolean {
    return isBatchCollectSupported(parsed.platform, parsed.pageType, this.devMode);
  }

  private getUnsupportedReason(parsed: ParsedUrl): string {
    const feature = PLATFORM_FEATURES[parsed.platform];
    if (feature?.status !== 'enabled' && !this.devMode) {
      return `${feature.label}暂未支持`;
    }
    return '不支持的URL类型，目前批量采集支持小红书作者主页';
  }

  private async applySettings(): Promise<void> {
    const state = unwrapStoredSettings(await ChromeStorage.getItem<StoredAppSettings>(SETTINGS_STORAGE_KEY));
    const minInterval = Number(state?.collectIntervalMinMs ?? DEFAULT_SETTINGS.collectIntervalMinMs);
    const maxInterval = Number(state?.collectIntervalMaxMs ?? DEFAULT_SETTINGS.collectIntervalMaxMs);
    const normalizedMin = Number.isFinite(minInterval) ? Math.max(1000, minInterval) : DEFAULT_SETTINGS.collectIntervalMinMs;
    const normalizedMax = Number.isFinite(maxInterval) ? Math.max(normalizedMin, maxInterval) : DEFAULT_SETTINGS.collectIntervalMaxMs;

    this.config = {
      minInterval: normalizedMin,
      maxInterval: normalizedMax,
      maxRetries: DEFAULT_BATCH_COLLECT_CONFIG.maxRetries
    };
    this.devMode = Boolean(state?.devMode);
  }

  private async collectXhsAuthor(task: CollectTask): Promise<CollectResult> {
    console.log(`[BatchCollectManager] 使用小红书API采集: ${task.url}`);

    try {
      const authorData = await fetchUserOtherInfo(
        task.parsed.id,
        task.parsed.xsecSource,
        task.parsed.xsecToken
      );

      if (!authorData) {
        return {
          success: false,
          url: task.url,
          error: 'API获取用户信息失败'
        };
      }

      await addAuthor(authorData as AuthorEntity);

      return {
        success: true,
        url: task.url,
        data: authorData as AuthorEntity
      };
    } catch (error) {
      return {
        success: false,
        url: task.url,
        error: error instanceof Error ? error.message : 'API采集异常'
      };
    }
  }

  private async collectPgyAuthor(task: CollectTask): Promise<CollectResult> {
    console.log(`[BatchCollectManager] 使用蒲公英API采集: ${task.url}`);

    try {
      const authorData = await fetchPgyCreatorInfo(task.parsed.id);

      if (!authorData) {
        return {
          success: false,
          url: task.url,
          error: '蒲公英API获取用户信息失败'
        };
      }

      await addAuthor(authorData as AuthorEntity);

      return {
        success: true,
        url: task.url,
        data: authorData as AuthorEntity
      };
    } catch (error) {
      return {
        success: false,
        url: task.url,
        error: error instanceof Error ? error.message : '蒲公英API采集异常'
      };
    }
  }

  private async collectPgyPost(task: CollectTask): Promise<CollectResult> {
    console.log(`[BatchCollectManager] 使用蒲公英API采集帖子: ${task.url}`);

    try {
      const postData = await fetchPgyPostDetail(task.parsed.id);

      if (!postData) {
        return {
          success: false,
          url: task.url,
          error: '蒲公英API获取帖子详情失败'
        };
      }

      await addPost(postData as PostEntity);

      return {
        success: true,
        url: task.url,
        data: postData as PostEntity
      };
    } catch (error) {
      return {
        success: false,
        url: task.url,
        error: error instanceof Error ? error.message : '蒲公英API帖子采集异常'
      };
    }
  }

  private async completeBatchCollect(): Promise<void> {
    this.isRunning = false;
    this.isPaused = false;

    const finalStatus = this.progress.failed === 0 ? 'completed' :
      this.progress.success === 0 ? 'error' : 'completed';

    this.progress.status = finalStatus as 'completed' | 'error';
    this.progress.currentUrl = '';

    if (this.taskId) {
      await updateTask(this.taskId, {
        status: this.progress.failed === 0 ? 'success' : 'failed',
        successCount: this.progress.success,
        failedCount: this.progress.failed
      });
    }

    console.log(`[BatchCollectManager] 批量采集完成，成功: ${this.progress.success}, 失败: ${this.progress.failed}`);
    this.notifyProgress();
  }

  pause(): void {
    if (!this.isRunning) return;
    this.isPaused = true;
    this.progress.status = 'paused';
    this.notifyProgress();
    console.log('[BatchCollectManager] 采集已暂停');
  }

  resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.progress.status = 'running';
    this.notifyProgress();
    console.log('[BatchCollectManager] 采集已继续');
  }

  cancel(): void {
    if (!this.isRunning) return;

    this.abortController?.abort();
    this.isRunning = false;
    this.isPaused = false;
    this.progress.status = 'completed';

    if (this.taskId) {
      updateTask(this.taskId, {
        status: 'canceled',
        successCount: this.progress.success,
        failedCount: this.progress.failed
      });
    }

    console.log('[BatchCollectManager] 采集已取消');
    this.notifyProgress();
  }

  getProgress(): BatchCollectProgress {
    return { ...this.progress };
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  private getRandomInterval(): number {
    const { minInterval, maxInterval } = this.config;
    return Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
  }

  private notifyProgress(): void {
    chrome.runtime.sendMessage({
      type: 'batch:collect:progress',
      data: { progress: this.progress }
    }).catch(() => {});
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      const timer = setTimeout(resolve, ms);
      this.abortController?.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

export const batchCollectManager = new BatchCollectManager();
