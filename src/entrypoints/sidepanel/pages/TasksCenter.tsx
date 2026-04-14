import { useEffect, useState } from 'react';
import { useTasksStore, useUIStore } from '@/shared/store';
import { Trash2, RefreshCw, ChevronRight, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
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

const statusConfig: Record<TaskStatus, { label: string; bgColor: string; textColor: string; icon: typeof CheckCircle }> = {
  pending: { label: '等待中', bgColor: 'bg-gray-100', textColor: 'text-gray-600', icon: Clock },
  running: { label: '进行中', bgColor: 'bg-blue-100', textColor: 'text-blue-600', icon: Loader2 },
  success: { label: '成功', bgColor: 'bg-green-100', textColor: 'text-green-600', icon: CheckCircle },
  failed: { label: '失败', bgColor: 'bg-red-100', textColor: 'text-red-600', icon: XCircle },
  canceled: { label: '已取消', bgColor: 'bg-gray-100', textColor: 'text-gray-600', icon: XCircle }
};

/**
 * 任务中心页面组件
 */
export default function TasksCenter() {
  const { tasks, loading, fetchTasks, clearCompleted, retryTask, deleteTask } = useTasksStore();
  const { openTaskDetailDrawer } = useUIStore();
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');

  useEffect(() => {
    fetchTasks(statusFilter || undefined);
  }, [statusFilter]);

  const handleClearCompleted = async () => {
    if (confirm('确定要清空所有已完成的任务吗？')) {
      await clearCompleted();
    }
  };

  const handleRetry = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await retryTask(id);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除此任务吗？')) {
      await deleteTask(id);
    }
  };

  const handleTaskClick = (id: string) => {
    openTaskDetailDrawer(id);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">任务中心</h2>
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TaskStatus | '')}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            
            <button
              onClick={handleClearCompleted}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              清空已完成
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
              <div className="text-gray-400">加载中...</div>
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <Clock className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-sm">暂无任务</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const config = statusConfig[task.status];
              const Icon = config.icon;
              
              return (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task.id)}
                  className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer border border-transparent hover:border-primary-200 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                          config.bgColor,
                          config.textColor
                        )}>
                          <Icon className={cn(
                            'w-3 h-3',
                            task.status === 'running' && 'animate-spin'
                          )} />
                          {config.label}
                        </span>
                        <span className="text-sm font-medium text-gray-800">
                          {taskTypeLabels[task.taskType]}
                        </span>
                      </div>
                      
                      {task.title && (
                        <p className="text-sm text-gray-600 mb-2 truncate">{task.title}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(task.createdAt)}
                        </span>
                        {task.totalCount !== undefined && task.totalCount > 0 && (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            {task.successCount || 0}/{task.totalCount}
                          </span>
                        )}
                        {task.progress !== undefined && task.progress > 0 && task.status === 'running' && (
                          <span className="text-primary-500">{task.progress}%</span>
                        )}
                      </div>
                      
                      {task.errorMessage && (
                        <p className="text-xs text-red-500 mt-2 truncate">{task.errorMessage}</p>
                      )}
                      
                      {task.status === 'running' && task.progress !== undefined && task.progress > 0 && (
                        <div className="mt-2">
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-primary-400 to-primary-500 transition-all duration-300"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 ml-2">
                      <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-primary-400 transition-colors" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
