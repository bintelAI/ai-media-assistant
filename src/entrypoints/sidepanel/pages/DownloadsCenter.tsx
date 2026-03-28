import { useEffect } from 'react';
import { useTasksStore } from '@/shared/store';
import { Trash2, RefreshCw } from 'lucide-react';
import { formatDate, cn } from '@/shared/utils/helpers';

export default function DownloadsCenter() {
  const { tasks, loading, fetchTasks, retryTask, deleteTask } = useTasksStore();

  useEffect(() => {
    fetchTasks(undefined, 'download_media');
  }, []);

  const downloadTasks = tasks.filter(t => t.taskType === 'download_media');

  const handleRetry = async (id: string) => {
    await retryTask(id);
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除此记录吗？')) {
      await deleteTask(id);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-gray-200 p-3">
        <h3 className="font-medium">下载记录</h3>
      </div>
      
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">加载中...</div>
          </div>
        ) : downloadTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p>暂无下载记录</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {downloadTasks.map((task) => (
              <div key={task.id} className="p-3 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded',
                        task.status === 'success' ? 'bg-green-100 text-green-600' :
                        task.status === 'failed' ? 'bg-red-100 text-red-600' :
                        task.status === 'running' ? 'bg-blue-100 text-blue-600' :
                        'bg-gray-100 text-gray-600'
                      )}>
                        {task.status === 'success' ? '成功' :
                         task.status === 'failed' ? '失败' :
                         task.status === 'running' ? '下载中' : '等待中'}
                      </span>
                    </div>
                    
                    {task.title && (
                      <p className="text-sm text-gray-600 mt-1">{task.title}</p>
                    )}
                    
                    {task.errorMessage && (
                      <p className="text-xs text-red-500 mt-1">{task.errorMessage}</p>
                    )}
                    
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>{formatDate(task.createdAt)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {task.status === 'failed' && (
                      <button
                        onClick={() => handleRetry(task.id)}
                        className="p-1 text-gray-400 hover:text-primary-500"
                        title="重试"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
