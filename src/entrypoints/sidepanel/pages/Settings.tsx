import { useSettingsStore } from '@/shared/store';
import { clearPosts, clearAuthors, clearComments, clearTasks } from '@/shared/db';
import { Trash2, RotateCcw } from 'lucide-react';

export default function Settings() {
  const {
    defaultExportFormat,
    autoDedupe,
    autoOpenSidePanel,
    taskConcurrency,
    retryCount,
    updateSettings,
    resetSettings
  } = useSettingsStore();

  const handleClearPosts = async () => {
    if (confirm('确定要清空所有帖子数据吗？此操作不可恢复。')) {
      await clearPosts();
      alert('帖子数据已清空');
    }
  };

  const handleClearAuthors = async () => {
    if (confirm('确定要清空所有作者数据吗？此操作不可恢复。')) {
      await clearAuthors();
      alert('作者数据已清空');
    }
  };

  const handleClearComments = async () => {
    if (confirm('确定要清空所有评论数据吗？此操作不可恢复。')) {
      await clearComments();
      alert('评论数据已清空');
    }
  };

  const handleClearAll = async () => {
    if (confirm('确定要清空所有数据吗？此操作不可恢复。')) {
      await Promise.all([
        clearPosts(),
        clearAuthors(),
        clearComments(),
        clearTasks()
      ]);
      alert('所有数据已清空');
    }
  };

  const handleResetSettings = () => {
    if (confirm('确定要重置所有设置吗？')) {
      resetSettings();
    }
  };

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium">基础设置</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">默认导出格式</p>
              <p className="text-xs text-gray-400">选择导出数据的默认格式</p>
            </div>
            <select
              value={defaultExportFormat}
              onChange={(e) => updateSettings({ defaultExportFormat: e.target.value as 'csv' | 'excel' | 'json' })}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="excel">Excel</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">自动去重</p>
              <p className="text-xs text-gray-400">采集时自动跳过已存在的数据</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoDedupe}
                onChange={(e) => updateSettings({ autoDedupe: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">采集后自动打开侧栏</p>
              <p className="text-xs text-gray-400">采集完成后自动打开 Side Panel</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoOpenSidePanel}
                onChange={(e) => updateSettings({ autoOpenSidePanel: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
            </label>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium">任务设置</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">并发数</p>
              <p className="text-xs text-gray-400">同时执行的任务数量</p>
            </div>
            <input
              type="number"
              min={1}
              max={5}
              value={taskConcurrency}
              onChange={(e) => updateSettings({ taskConcurrency: parseInt(e.target.value) })}
              className="w-16 px-2 py-1 border border-gray-300 rounded-md text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">重试次数</p>
              <p className="text-xs text-gray-400">任务失败后的重试次数</p>
            </div>
            <input
              type="number"
              min={0}
              max={5}
              value={retryCount}
              onChange={(e) => updateSettings({ retryCount: parseInt(e.target.value) })}
              className="w-16 px-2 py-1 border border-gray-300 rounded-md text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium">数据管理</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm">帖子数据</p>
            <button
              onClick={handleClearPosts}
              className="flex items-center gap-1 px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded"
            >
              <Trash2 className="w-4 h-4" />
              清空
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <p className="text-sm">作者数据</p>
            <button
              onClick={handleClearAuthors}
              className="flex items-center gap-1 px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded"
            >
              <Trash2 className="w-4 h-4" />
              清空
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <p className="text-sm">评论数据</p>
            <button
              onClick={handleClearComments}
              className="flex items-center gap-1 px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded"
            >
              <Trash2 className="w-4 h-4" />
              清空
            </button>
          </div>
          
          <div className="pt-2 border-t border-gray-200">
            <button
              onClick={handleClearAll}
              className="w-full py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded"
            >
              清空所有数据
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium">其他</h3>
        </div>
        <div className="p-4">
          <button
            onClick={handleResetSettings}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            <RotateCcw className="w-4 h-4" />
            重置所有设置
          </button>
        </div>
      </div>
    </div>
  );
}
