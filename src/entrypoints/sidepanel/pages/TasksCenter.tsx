import { useEffect, useState } from 'react';
import { useTasksStore } from '@/shared/store';
import { Trash2, RefreshCw } from 'lucide-react';
import { formatDate, cn } from '@/shared/utils/helpers';
import type { TaskStatus, TaskType } from '@/shared/types';

const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '等待中' },
  { value: 'running', label: '进行中' },
  { value: 'success', label: '成功' },
  { value: 'failed', label: '失败' }
];

const taskTypeLabels: Record<TaskType, string> = {
  collect_post: '采集帖子',
  collect_author: '采集作者',
  collect_comments: '采集评论',
  export_data: '导出数据',
  download_media: '下载媒体'
};

export default function TasksCenter() {
  const { tasks, loading, fetchTasks, clearCompleted, retryTask, deleteTask } = useTasksStore();
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');

  useEffect(() => {
    fetchTasks(statusFilter || undefined);
  }, [statusFilter]);

  const handleClearCompleted = async () => {
    if (confirm('确定要清空所有已完成的任务吗？')) {
      await clearCompleted();
    }
  };

  const handleRetry = async (id: string) => {
    await retryTask(id);
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除此任务吗？')) {
      await deleteTask(id);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-gray-200 p-3">
        <div className="flex items-center justify-between">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TaskStatus | '')}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          
          <button
            onClick={handleClearCompleted}
            className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <Trash2 className="w-4 h-4" />
            清空已完成
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">加载中...</div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p>暂无任务</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tasks.map((task) => (
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
                         task.status === 'running' ? '进行中' : '等待中'}
                      </span>
                      <span className="text-sm font-medium">
                        {taskTypeLabels[task.taskType]}
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
                      {task.progress !== undefined && task.progress > 0 && (
                        <span>{task.progress}%</span>
                      )}
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
                    {(task.status === 'success' || task.status === 'failed') && (
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="p-1 text-gray-400 hover:text-red-500"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
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
