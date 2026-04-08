import { DEFAULT_BATCH_COLLECT_CONFIG } from '@/shared/types/batchCollect';
import type { BatchCollectConfig } from '@/shared/types/batchCollect';

/**
 * 后台标签页管理器
 * 负责创建、管理和关闭后台标签页
 */
export class TabManager {
  private activeTabs: Map<number, chrome.tabs.Tab> = new Map();
  private config: BatchCollectConfig;

  /**
   * 创建标签页管理器实例
   * @param config 批量采集配置
   */
  constructor(config: Partial<BatchCollectConfig> = {}) {
    this.config = { ...DEFAULT_BATCH_COLLECT_CONFIG, ...config };
  }

  /**
   * 创建后台标签页
   * @param url 要打开的URL
   * @returns 标签页ID
   */
  async createBackgroundTab(url: string): Promise<number> {
    while (this.activeTabs.size >= this.config.maxConcurrentTabs) {
      await this.sleep(500);
    }

    const tab = await chrome.tabs.create({
      url: url,
      active: false
    });

    if (tab.id) {
      this.activeTabs.set(tab.id, tab);
    }

    return tab.id!;
  }

  /**
   * 关闭标签页
   * @param tabId 标签页ID
   */
  async closeTab(tabId: number): Promise<void> {
    try {
      await chrome.tabs.remove(tabId);
      this.activeTabs.delete(tabId);
    } catch (error) {
      console.warn('[TabManager] 关闭标签页失败:', error);
    }
  }

  /**
   * 等待标签页加载完成
   * @param tabId 标签页ID
   * @param timeout 超时时间（毫秒）
   */
  async waitForTabComplete(tabId: number, timeout?: number): Promise<void> {
    const actualTimeout = timeout || this.config.pageLoadTimeout;
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('页面加载超时'));
      }, actualTimeout);

      const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  /**
   * 从标签页提取数据
   * @param tabId 标签页ID
   * @returns 提取的数据
   */
  async extractDataFromTab(tabId: number): Promise<unknown> {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        return {
          url: window.location.href,
          title: document.title,
          html: document.documentElement.outerHTML
        };
      }
    });

    return results[0].result;
  }

  /**
   * 获取当前活跃标签页数量
   * @returns 活跃标签页数量
   */
  getActiveTabCount(): number {
    return this.activeTabs.size;
  }

  /**
   * 关闭所有活跃标签页
   */
  async closeAllTabs(): Promise<void> {
    const tabIds = Array.from(this.activeTabs.keys());
    for (const tabId of tabIds) {
      await this.closeTab(tabId);
    }
  }

  /**
   * 休眠函数
   * @param ms 休眠时间（毫秒）
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 全局标签页管理器实例
 */
export const tabManager = new TabManager();
