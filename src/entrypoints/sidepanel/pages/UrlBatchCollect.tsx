import { useState, useEffect, useRef, useCallback } from 'react';
import { sendMessage } from '@/shared/utils/messaging';
import { parseUrls, getPlatformDisplayName, getPageTypeDisplayName } from '@/shared/utils/urlParser';
import { useSettingsStore, useUIStore } from '@/shared/store';
import type { BatchCollectProgress, ParsedUrl } from '@/shared/types/batchCollect';
import type { BatchCollectStatusResponse } from '@/shared/types/messages';
import {
  Play, Pause, Square, Upload, Link, CheckCircle, XCircle,
  Loader2, FileText, AlertCircle, Trash2, Timer, ListChecks
} from 'lucide-react';
import { cn } from '@/shared/utils/helpers';
import { isBatchCollectSupported, PLATFORM_FEATURES } from '@/shared/utils/constants';

/**
 * URL批量采集页面组件
 */
export default function UrlBatchCollect() {
  const [urlInput, setUrlInput] = useState('');
  const [parsedUrls, setParsedUrls] = useState<ParsedUrl[]>([]);
  const [unsupportedUrls, setUnsupportedUrls] = useState<Array<{ url: string; reason: string }>>([]);
  const [invalidUrls, setInvalidUrls] = useState<string[]>([]);
  const [progress, setProgress] = useState<BatchCollectProgress>({
    total: 0,
    current: 0,
    success: 0,
    failed: 0,
    currentUrl: '',
    status: 'idle',
    results: []
  });
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useUIStore();
  const { devMode, collectIntervalMinMs, collectIntervalMaxMs } = useSettingsStore();

  /**
   * 监听批量采集进度消息
   */
  useEffect(() => {
    const handleMessage = (message: { type: string; data?: { progress: BatchCollectProgress } }) => {
      if (message.type === 'batch:collect:progress' && message.data?.progress) {
        const newProgress = message.data.progress;
        const prevStatus = progress.status;
        
        setProgress(newProgress);
        setIsRunning(newProgress.status === 'running' || newProgress.status === 'paused');
        setIsPaused(newProgress.status === 'paused');
        
        if (prevStatus === 'running' && newProgress.status === 'completed') {
          showToast(
            `批量采集完成！成功 ${newProgress.success} 个，失败 ${newProgress.failed} 个`,
            newProgress.failed > 0 ? 'info' : 'success'
          );
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    fetchStatus();

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [progress.status]);

  /**
   * 获取当前批量采集状态
   */
  const fetchStatus = useCallback(async () => {
    const response = await sendMessage<undefined, BatchCollectStatusResponse>('batch:collect:status');
    if (response.success && response.data) {
      setIsRunning(response.data.isRunning);
      setIsPaused(response.data.isPaused);
      setProgress(response.data.progress);
    }
  }, []);

  /**
   * 解析URL输入
   */
  const handleParseUrls = () => {
    const urls = urlInput
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (urls.length === 0) {
      showToast('请输入至少一个URL', 'error');
      return;
    }

    const result = parseUrls(urls);
    const supported: ParsedUrl[] = [];
    const unsupported: Array<{ url: string; reason: string }> = [];

    result.valid.forEach((parsed) => {
      if (isBatchCollectSupported(parsed.platform, parsed.pageType, devMode)) {
        supported.push(parsed);
      } else {
        const feature = PLATFORM_FEATURES[parsed.platform];
        const reason = feature?.status !== 'enabled' && !devMode
          ? `${feature.label}暂未支持`
          : `${getPlatformDisplayName(parsed.platform)}${getPageTypeDisplayName(parsed.pageType)}暂未支持批量采集`;
        unsupported.push({ url: parsed.originalUrl, reason });
      }
    });

    setParsedUrls(supported);
    setUnsupportedUrls(unsupported);
    setInvalidUrls(result.invalid);

    if (supported.length === 0) {
      showToast(unsupported.length > 0 ? '解析成功，但当前没有可执行的批量采集URL' : '没有有效的URL', 'error');
    } else if (result.invalid.length > 0 || unsupported.length > 0) {
      showToast(`解析完成，可采集 ${supported.length} 个，已剔除 ${result.invalid.length + unsupported.length} 个`, 'info');
    } else {
      showToast(`成功解析${supported.length}个URL`, 'success');
    }
  };

  /**
   * 处理文件导入
   */
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const urls = content
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      setUrlInput(urls.join('\n'));
      showToast(`已导入${urls.length}个URL`, 'success');
    } catch (error) {
      showToast('文件读取失败', 'error');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * 开始批量采集
   */
  const handleStartCollect = async () => {
    if (parsedUrls.length === 0) {
      showToast('请先解析URL', 'error');
      return;
    }

    const urls = parsedUrls.map(p => p.originalUrl);
    const response = await sendMessage('batch:collect:start', { urls });

    if (response.success) {
      setIsRunning(true);
      setIsPaused(false);
      const data = response.data as { accepted?: number; skipped?: number } | undefined;
      showToast(
        data?.skipped ? `批量采集已开始，可采集 ${data.accepted || parsedUrls.length} 个，已剔除 ${data.skipped} 个` : '批量采集已开始',
        'success'
      );
    } else {
      showToast(response.error || '启动失败', 'error');
    }
  };

  /**
   * 暂停采集
   */
  const handlePauseCollect = async () => {
    const response = await sendMessage('batch:collect:control', { action: 'pause' });
    if (response.success) {
      setIsPaused(true);
      showToast('采集已暂停', 'info');
    }
  };

  /**
   * 继续采集
   */
  const handleResumeCollect = async () => {
    const response = await sendMessage('batch:collect:control', { action: 'resume' });
    if (response.success) {
      setIsPaused(false);
      showToast('采集已继续', 'info');
    }
  };

  /**
   * 取消采集
   */
  const handleCancelCollect = async () => {
    const response = await sendMessage('batch:collect:control', { action: 'cancel' });
    if (response.success) {
      setIsRunning(false);
      setIsPaused(false);
      showToast('采集已取消', 'info');
    }
  };

  /**
   * 清空URL列表
   */
  const handleClearUrls = () => {
    setUrlInput('');
    setParsedUrls([]);
    setUnsupportedUrls([]);
    setInvalidUrls([]);
  };

  /**
   * 计算进度百分比
   */
  const progressPercent = progress.total > 0 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;
  const intervalLabel = `${Math.round(collectIntervalMinMs / 1000)}-${Math.round(collectIntervalMaxMs / 1000)}秒`;

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="border-b border-gray-200 bg-white p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-950">
          <Link className="h-5 w-5 text-primary-600" />
          URL批量采集
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          输入 URL 或导入文件，系统会按设置的随机间隔逐条采集
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-4">
        {!isRunning ? (
          <>
            <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-900">URL列表</label>
                  <p className="mt-0.5 text-xs text-gray-500">支持 `.txt` / `.csv`，每行一个 URL；当前批量采集仅开放小红书作者主页。</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                    title="导入 .txt 或 .csv 文件，每行一个 URL"
                  >
                    <Upload className="h-4 w-4" />
                    导入文件
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.csv"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={handleClearUrls}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    清空
                  </button>
                </div>
              </div>
              <textarea
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="请输入URL，每行一个&#10;当前批量采集支持小红书作者主页&#10;蒲公英、星图暂未支持&#10;&#10;示例：&#10;https://www.xiaohongshu.com/user/profile/xxxxx"
                className="h-40 w-full resize-none rounded-lg border border-gray-200 p-3 text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 text-xs text-gray-500">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  已输入 {urlInput.split('\n').filter(u => u.trim()).length} 个URL
                  <span className="text-gray-300">|</span>
                  <Timer className="h-3.5 w-3.5 shrink-0" />
                  随机间隔 {intervalLabel}
                </div>
                <button
                  type="button"
                  onClick={handleParseUrls}
                  className="min-h-[44px] rounded-md bg-primary-500 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  解析URL
                </button>
              </div>
            </section>

            {invalidUrls.length > 0 && (
              <section className="rounded-lg border border-red-100 bg-red-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">无效URL ({invalidUrls.length})</span>
                </div>
                <div className="max-h-24 overflow-auto">
                  {invalidUrls.map((url, index) => (
                    <div key={index} className="text-xs text-red-500 truncate">
                      {url}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {unsupportedUrls.length > 0 && (
              <section className="rounded-lg border border-amber-100 bg-amber-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-amber-700">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">暂未支持 ({unsupportedUrls.length})</span>
                </div>
                <div className="max-h-28 overflow-auto space-y-1">
                  {unsupportedUrls.map((item, index) => (
                    <div key={index} className="text-xs text-amber-700">
                      <div className="truncate">{item.url}</div>
                      <div className="text-amber-600">{item.reason}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {parsedUrls.length > 0 && (
              <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <ListChecks className="h-4 w-4 text-primary-600" />
                    有效URL ({parsedUrls.length})
                  </span>
                </div>
                <div className="max-h-60 overflow-auto space-y-2">
                  {parsedUrls.map((parsed, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{parsed.originalUrl}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 bg-primary-100 text-primary-600 rounded">
                            {getPlatformDisplayName(parsed.platform)}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                            {getPageTypeDisplayName(parsed.pageType)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-gray-900">采集进度</span>
              <span className={cn(
                'rounded-md px-2 py-1 text-xs font-medium',
                progress.status === 'preparing' && 'bg-slate-100 text-slate-700',
                progress.status === 'running' && 'bg-blue-100 text-blue-600',
                progress.status === 'paused' && 'bg-yellow-100 text-yellow-600',
                progress.status === 'completed' && 'bg-green-100 text-green-600',
                progress.status === 'error' && 'bg-red-100 text-red-600'
              )}>
                {progress.status === 'preparing' && '准备中'}
                {progress.status === 'running' && '采集中'}
                {progress.status === 'paused' && '已暂停'}
                {progress.status === 'completed' && '已完成'}
                {progress.status === 'error' && '出错'}
              </span>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-500">{progress.current} / {progress.total}</span>
                <span className="text-gray-500">{progressPercent}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {progress.currentUrl && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">当前处理</div>
                <div className="text-sm truncate">{progress.currentUrl}</div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{progress.success}</div>
                <div className="text-xs text-green-600">成功</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{progress.failed}</div>
                <div className="text-xs text-red-600">失败</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">
                  {progress.total - progress.current}
                </div>
                <div className="text-xs text-gray-600">待处理</div>
              </div>
            </div>

            {progress.results.length > 0 && (
              <div className="max-h-40 overflow-auto">
                <div className="text-xs text-gray-500 mb-2">采集结果</div>
                {progress.results.slice(-10).map((result, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-center gap-2 py-1.5 text-sm',
                      result.success ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {result.success ? (
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="truncate">{result.url}</span>
                    {!result.success && result.error && (
                      <span className="text-xs text-red-400">({result.error})</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <div className="border-t border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-sm text-gray-500">
            {isRunning ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                {isPaused ? '采集已暂停' : `采集中，随机间隔${intervalLabel}...`}
              </span>
            ) : (
              <span>当前支持小红书作者主页，蒲公英/星图暂未支持</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isRunning ? (
              <>
                {isPaused ? (
                  <button
                    type="button"
                    onClick={handleResumeCollect}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-md bg-primary-500 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  >
                    <Play className="h-4 w-4" />
                    继续
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePauseCollect}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-md bg-yellow-500 px-4 text-sm font-medium text-white transition-colors hover:bg-yellow-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2"
                  >
                    <Pause className="h-4 w-4" />
                    暂停
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCancelCollect}
                  className="flex min-h-[44px] items-center gap-1.5 rounded-md bg-red-500 px-4 text-sm font-medium text-white transition-colors hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                >
                  <Square className="h-4 w-4" />
                  取消
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleStartCollect}
                disabled={parsedUrls.length === 0}
                className={cn(
                  'flex min-h-[44px] items-center gap-1.5 rounded-md px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
                  parsedUrls.length > 0
                    ? 'bg-primary-500 text-white hover:bg-primary-600'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                <Play className="h-4 w-4" />
                开始采集
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
