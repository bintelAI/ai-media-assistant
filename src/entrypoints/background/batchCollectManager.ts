import { parseUrl } from '@/shared/utils/urlParser';
import { addAuthor } from '@/shared/db/authors';
import { addTask, updateTask } from '@/shared/db/tasks';
import { fetchUserOtherInfo } from '@/shared/services/xhs-user-service';
import type {
  CollectTask,
  BatchCollectProgress,
  CollectResult,
  BatchCollectConfig,
  ParsedUrl
} from '@/shared/types/batchCollect';
import { DEFAULT_BATCH_COLLECT_CONFIG } from '@/shared/types/batchCollect';
import type { AuthorEntity } from '@/shared/types/entities';

/**
 * 批量采集任务管理器
 * 负责管理URL批量采集任务队列、进度通知和数据保存
 * 仅支持API直接采集方式
 */
export class BatchCollectManager {
  private taskQueue: CollectTask[] = [];
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private currentIndex: number = 0;
  private config: BatchCollectConfig;
  private progress: BatchCollectProgress;
  private taskId: string | null = null;
  private abortController: AbortController | null = null;

  /**
   * 创建批量采集管理器实例
   * @param config 批量采集配置
   */
  constructor(config: Partial<BatchCollectConfig> = {}) {
    this.config = { ...DEFAULT_BATCH_COLLECT_CONFIG, ...config };
    this.progress = this.initProgress();
  }

  /**
   * 初始化进度状态
   * @returns 初始化的进度对象
   */
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

  /**
   * 开始批量采集
   * @param urls 要采集的URL列表
   */
  async startBatchCollect(urls: string[]): Promise<void> {
    if (this.isRunning) {
      console.warn('[BatchCollectManager] 已有采集任务在运行');
      return;
    }

    const parsedUrls = urls
      .map(url => parseUrl(url.trim()))
      .filter((parsed): parsed is ParsedUrl => parsed !== null);

    if (parsedUrls.length === 0) {
      console.warn('[BatchCollectManager] 没有有效的URL');
      return;
    }

    this.taskQueue = parsedUrls.map(parsed => ({
      url: parsed.originalUrl,
      parsed,
      status: 'pending' as const,
      retryCount: 0
    }));

    this.isRunning = true;
    this.isPaused = false;
    this.currentIndex = 0;
    this.progress = {
      total: this.taskQueue.length,
      current: 0,
      success: 0,
      failed: 0,
      currentUrl: '',
      status: 'running',
      results: []
    };

    this.abortController = new AbortController();

    this.taskId = await addTask({
      taskType: 'collect_post',
      title: `URL批量采集 (${this.taskQueue.length}个)`,
      status: 'running',
      totalCount: this.taskQueue.length
    });

    console.log(`[BatchCollectManager] 开始批量采集，共 ${this.taskQueue.length} 个URL`);
    this.notifyProgress();

    await this.processQueue();
  }

  /**
   * 处理任务队列
   */
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
      this.progress.current = this.currentIndex + 1;

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

  /**
   * 执行单个采集任务
   * 仅支持API直接采集方式
   * @param task 采集任务
   * @returns 采集结果
   */
  private async collectTask(task: CollectTask): Promise<CollectResult> {
    if (!this.canUseApiCollect(task.parsed)) {
      return {
        success: false,
        url: task.url,
        error: '不支持的URL类型，仅支持小红书用户主页采集'
      };
    }
    return this.collectViaApi(task);
  }

  /**
   * 判断是否可以使用API直接采集
   * @param parsed 解析后的URL信息
   * @returns 是否可以使用API
   */
  private canUseApiCollect(parsed: ParsedUrl): boolean {
    return parsed.platform === 'xhs' && parsed.pageType === 'author_profile';
  }

  /**
   * 通过API直接采集（不打开标签页）
   * @param task 采集任务
   * @returns 采集结果
   */
  private async collectViaApi(task: CollectTask): Promise<CollectResult> {
    console.log(`[BatchCollectManager] 使用API采集: ${task.url}`);

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

  /**
   * 完成批量采集
   */
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

  /**
   * 暂停采集
   */
  pause(): void {
    if (!this.isRunning) return;
    this.isPaused = true;
    this.progress.status = 'paused';
    this.notifyProgress();
    console.log('[BatchCollectManager] 采集已暂停');
  }

  /**
   * 继续采集
   */
  resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.progress.status = 'running';
    this.notifyProgress();
    console.log('[BatchCollectManager] 采集已继续');
  }

  /**
   * 取消采集
   */
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

  /**
   * 获取当前进度
   * @returns 当前进度状态
   */
  getProgress(): BatchCollectProgress {
    return { ...this.progress };
  }

  /**
   * 获取运行状态
   * @returns 是否正在运行
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 获取暂停状态
   * @returns 是否已暂停
   */
  getIsPaused(): boolean {
    return this.isPaused;
  }

  /**
   * 获取随机间隔时间
   * @returns 随机间隔时间（毫秒）
   */
  private getRandomInterval(): number {
    const { minInterval, maxInterval } = this.config;
    return Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
  }

  /**
   * 通知进度更新
   */
  private notifyProgress(): void {
    chrome.runtime.sendMessage({
      type: 'batch:collect:progress',
      data: { progress: this.progress }
    }).catch(() => {
      // 忽略没有监听者的错误
    });
  }

  /**
   * 休眠函数
   * @param ms 休眠时间（毫秒）
   */
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

/**
 * 全局批量采集管理器实例
 */
export const batchCollectManager = new BatchCollectManager();
