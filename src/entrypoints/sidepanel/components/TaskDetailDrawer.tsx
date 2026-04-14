import { X, CheckCircle, XCircle, Clock, Link, Calendar, RefreshCw, Trash2 } from 'lucide-react';
import { useUIStore, useTasksStore } from '@/shared/store';
import { formatDate, cn } from '@/shared/utils/helpers';
import type { TaskType, TaskStatus } from '@/shared/types';

const taskTypeLabels: Record<TaskType, string> = {
  collect_post: '采集帖子',
  collect_author: '采集作者',
  collect_comments: '采集评论',
  export_data: '导出数据',
  download_media: '下载媒体'
};

const statusConfig: Record<TaskStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: '等待中', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  running: { label: '进行中', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  success: { label: '成功', color: 'text-green-600', bgColor: 'bg-green-100' },
  failed: { label: '失败', color: 'text-red-600', bgColor: 'bg-red-100' },
  canceled: { label: '已取消', color: 'text-gray-600', bgColor: 'bg-gray-100' }
};

/**
 * 任务详情抽屉组件
 */
export default function TaskDetailDrawer() {
  const { taskDetailOpen, taskDetailId, closeTaskDetailDrawer } = useUIStore();
  const { tasks, retryTask, deleteTask } = useTasksStore();

  const task = tasks.find(t => t.id === taskDetailId);

  if (!taskDetailOpen || !task) return null;

  const config = statusConfig[task.status];

  const handleRetry = async () => {
    await retryTask(task.id);
    closeTaskDetailDrawer();
  };

  const handleDelete = async () => {
    if (confirm('确定要删除此任务吗？')) {
      await deleteTask(task.id);
      closeTaskDetailDrawer();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div 
        className="absolute inset-0 bg-black/30"
        onClick={closeTaskDetailDrawer}
      />
      
      <div className="relative w-96 h-full bg-white shadow-xl animate-slide-in-right flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">任务详情</h3>
          <button
            onClick={closeTaskDetailDrawer}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="flex items-center gap-3">
            <span className={cn(
              'px-3 py-1 rounded-full text-sm font-medium',
              config.bgColor,
              config.color
            )}>
              {config.label}
            </span>
            <span className="text-sm font-medium text-gray-700">
              {taskTypeLabels[task.taskType]}
            </span>
          </div>

          {task.title && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">任务标题</div>
              <div className="text-sm text-gray-700">{task.title}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">创建时间</div>
              <div className="text-sm text-gray-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(task.createdAt)}
              </div>
            </div>
            
            {task.finishedAt && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">完成时间</div>
                <div className="text-sm text-gray-700 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {formatDate(task.finishedAt)}
                </div>
              </div>
            )}
          </div>

          {(task.totalCount !== undefined || task.successCount !== undefined || task.failedCount !== undefined) && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-3">采集统计</div>
              <div className="grid grid-cols-3 gap-3">
                {task.totalCount !== undefined && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-700">{task.totalCount}</div>
                    <div className="text-xs text-gray-500">总数</div>
                  </div>
                )}
                {task.successCount !== undefined && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{task.successCount}</div>
                    <div className="text-xs text-gray-500">成功</div>
                  </div>
                )}
                {task.failedCount !== undefined && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{task.failedCount}</div>
                    <div className="text-xs text-gray-500">失败</div>
                  </div>
                )}
              </div>
              
              {task.totalCount && task.totalCount > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>进度</span>
                    <span>
                      {task.progress !== undefined ? `${task.progress}%` : 
                        `${((task.successCount || 0) + (task.failedCount || 0))}/${task.totalCount}`}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
                    {task.successCount !== undefined && task.successCount > 0 && (
                      <div 
                        className="bg-green-500 h-full"
                        style={{ width: `${(task.successCount / task.totalCount) * 100}%` }}
                      />
                    )}
                    {task.failedCount !== undefined && task.failedCount > 0 && (
                      <div 
                        className="bg-red-500 h-full"
                        style={{ width: `${(task.failedCount / task.totalCount) * 100}%` }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {task.targetUrl && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">目标链接</div>
              <a 
                href={task.targetUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary-500 hover:underline flex items-center gap-1 truncate"
              >
                <Link className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{task.targetUrl}</span>
              </a>
            </div>
          )}

          {task.errorMessage && (
            <div className="bg-red-50 rounded-lg p-3 border border-red-100">
              <div className="text-xs text-red-500 mb-1 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                错误信息
              </div>
              <div className="text-sm text-red-600">{task.errorMessage}</div>
            </div>
          )}

          {task.progress !== undefined && task.progress > 0 && task.status === 'running' && (
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
              <div className="text-xs text-blue-500 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                当前进度
              </div>
              <div className="text-sm text-blue-600">{task.progress}%</div>
              <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-2">
          {task.status === 'failed' && (
            <button
              onClick={handleRetry}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              重试
            </button>
          )}
          {(task.status === 'success' || task.status === 'failed' || task.status === 'canceled') && (
            <button
              onClick={handleDelete}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              删除
            </button>
          )}
          <button
            onClick={closeTaskDetailDrawer}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
