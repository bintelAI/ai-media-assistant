import { useState, useEffect, useRef, useCallback } from 'react';
import { sendMessage } from '@/shared/utils/messaging';
import { parseUrls, getPlatformDisplayName, getPageTypeDisplayName } from '@/shared/utils/urlParser';
import { useUIStore } from '@/shared/store';
import type { BatchCollectProgress, ParsedUrl } from '@/shared/types/batchCollect';
import type { BatchCollectStatusResponse } from '@/shared/types/messages';
import {
  Play, Pause, Square, Upload, Link, CheckCircle, XCircle,
  Loader2, FileText, AlertCircle, Trash2
} from 'lucide-react';
import { cn } from '@/shared/utils/helpers';

/**
 * URL批量采集页面组件
 */
export default function UrlBatchCollect() {
  const [urlInput, setUrlInput] = useState('');
  const [parsedUrls, setParsedUrls] = useState<ParsedUrl[]>([]);
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
    setParsedUrls(result.valid);
    setInvalidUrls(result.invalid);

    if (result.valid.length === 0) {
      showToast('没有有效的URL', 'error');
    } else if (result.invalid.length > 0) {
      showToast(`解析完成，${result.invalid.length}个无效URL`, 'info');
    } else {
      showToast(`成功解析${result.valid.length}个URL`, 'success');
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
      showToast('批量采集已开始', 'success');
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
    setInvalidUrls([]);
  };

  /**
   * 计算进度百分比
   */
  const progressPercent = progress.total > 0 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Link className="w-5 h-5 text-primary-500" />
          URL批量采集
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          输入或导入URL列表，系统将自动访问并采集数据
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {!isRunning ? (
          <>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700">URL列表</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <Upload className="w-4 h-4" />
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
                    onClick={handleClearUrls}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    清空
                  </button>
                </div>
              </div>
              <textarea
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="请输入URL，每行一个&#10;支持小红书、抖音、快手、TikTok等平台&#10;&#10;示例：&#10;https://www.xiaohongshu.com/explore/xxxxx&#10;https://www.douyin.com/video/123456789"
                className="w-full h-40 p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-400">
                  已输入 {urlInput.split('\n').filter(u => u.trim()).length} 个URL
                </span>
                <button
                  onClick={handleParseUrls}
                  className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 transition-colors"
                >
                  解析URL
                </button>
              </div>
            </div>

            {invalidUrls.length > 0 && (
              <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                <div className="flex items-center gap-2 text-red-600 mb-2">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">无效URL ({invalidUrls.length})</span>
                </div>
                <div className="max-h-24 overflow-auto">
                  {invalidUrls.map((url, index) => (
                    <div key={index} className="text-xs text-red-500 truncate">
                      {url}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {parsedUrls.length > 0 && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">
                    有效URL ({parsedUrls.length})
                  </span>
                </div>
                <div className="max-h-60 overflow-auto space-y-2">
                  {parsedUrls.map((parsed, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
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
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-700">采集进度</span>
              <span className={cn(
                'text-xs px-2 py-1 rounded',
                progress.status === 'running' && 'bg-blue-100 text-blue-600',
                progress.status === 'paused' && 'bg-yellow-100 text-yellow-600',
                progress.status === 'completed' && 'bg-green-100 text-green-600',
                progress.status === 'error' && 'bg-red-100 text-red-600'
              )}>
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
                  className="h-full bg-gradient-to-r from-primary-500 to-purple-500 transition-all duration-300"
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
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {isRunning ? (
              <span className="flex items-center gap-1">
                <Loader2 className="w-4 h-4 animate-spin" />
                {isPaused ? '采集已暂停' : '采集中，随机间隔3-10秒...'}
              </span>
            ) : (
              <span>支持小红书、抖音、快手、TikTok</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isRunning ? (
              <>
                {isPaused ? (
                  <button
                    onClick={handleResumeCollect}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    继续
                  </button>
                ) : (
                  <button
                    onClick={handlePauseCollect}
                    className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600 transition-colors"
                  >
                    <Pause className="w-4 h-4" />
                    暂停
                  </button>
                )}
                <button
                  onClick={handleCancelCollect}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors"
                >
                  <Square className="w-4 h-4" />
                  取消
                </button>
              </>
            ) : (
              <button
                onClick={handleStartCollect}
                disabled={parsedUrls.length === 0}
                className={cn(
                  'flex items-center gap-1.5 px-6 py-2 text-sm rounded-lg transition-colors',
                  parsedUrls.length > 0
                    ? 'bg-primary-500 text-white hover:bg-primary-600'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                <Play className="w-4 h-4" />
                开始采集
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
