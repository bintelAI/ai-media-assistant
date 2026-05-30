import { useEffect, useState } from 'react';
import { useTasksStore, useUIStore } from '@/shared/store';
import { Trash2, ChevronRight, ChevronDown, Clock, CheckCircle, XCircle, Loader2, ListChecks, Activity } from 'lucide-react';
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
  pending: { label: '等待中', bgColor: 'bg-slate-100 ring-slate-200', textColor: 'text-slate-600', icon: Clock },
  running: { label: '进行中', bgColor: 'bg-sky-50 ring-sky-100', textColor: 'text-sky-700', icon: Loader2 },
  success: { label: '成功', bgColor: 'bg-emerald-50 ring-emerald-100', textColor: 'text-emerald-700', icon: CheckCircle },
  failed: { label: '失败', bgColor: 'bg-rose-50 ring-rose-100', textColor: 'text-rose-700', icon: XCircle },
  canceled: { label: '已取消', bgColor: 'bg-slate-100 ring-slate-200', textColor: 'text-slate-600', icon: XCircle }
};

/**
 * 任务中心页面组件
 */
export default function TasksCenter() {
  const { tasks, loading, fetchTasks, clearCompleted, deleteTask } = useTasksStore();
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

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除此任务吗？')) {
      await deleteTask(id);
    }
  };

  const handleTaskClick = (id: string) => {
    openTaskDetailDrawer(id);
  };

  const taskStats = {
    total: tasks.length,
    running: tasks.filter(task => task.status === 'running').length,
    failed: tasks.filter(task => task.status === 'failed').length,
  };

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm shadow-slate-200/60">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-slate-950">任务中心</h1>
            <p className="text-xs text-slate-500">查看采集、导出与下载任务的执行状态</p>
          </div>
          <button
            onClick={handleClearCompleted}
            className="flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            <Trash2 className="h-4 w-4" />
            清空
          </button>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-medium text-slate-400">当前列表</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-950">{taskStats.total}</p>
          </div>
          <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2">
            <p className="text-[11px] font-medium text-sky-600">进行中</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-sky-800">{taskStats.running}</p>
          </div>
          <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2">
            <p className="text-[11px] font-medium text-rose-600">异常</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-rose-800">{taskStats.failed}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TaskStatus | '')}
              className="min-h-[40px] w-full appearance-none rounded-md border border-slate-300 bg-white px-3 py-1.5 pr-8 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
              <div className="text-sm text-slate-500">加载任务队列...</div>
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white">
              <ListChecks className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-700">暂无任务</p>
            <p className="mt-1 max-w-[240px] text-xs leading-5 text-slate-400">开始采集、导出或入库后，执行记录会出现在这里。</p>
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
                  className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70 transition-colors hover:border-cyan-200 hover:bg-cyan-50/30 focus-within:ring-2 focus-within:ring-primary-500"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1',
                          config.bgColor,
                          config.textColor
                        )}>
                          <Icon className={cn(
                            'h-3 w-3',
                            task.status === 'running' && 'animate-spin'
                          )} />
                          {config.label}
                        </span>
                        <span className="truncate text-sm font-semibold text-slate-900">
                          {taskTypeLabels[task.taskType]}
                        </span>
                      </div>
                      
                      {task.title && (
                        <p className="mb-2 truncate text-sm text-slate-600">{task.title}</p>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(task.createdAt)}
                        </span>
                        {task.totalCount !== undefined && task.totalCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            {task.successCount || 0}/{task.totalCount}
                          </span>
                        )}
                        {task.progress !== undefined && task.progress > 0 && task.status === 'running' && (
                          <span className="font-medium text-sky-600">{task.progress}%</span>
                        )}
                      </div>
                      
                      {task.errorMessage && (
                        <p className="mt-2 truncate rounded-md border border-rose-100 bg-rose-50 px-2 py-1 text-xs text-rose-700">{task.errorMessage}</p>
                      )}
                      
                      {task.status === 'running' && task.progress !== undefined && task.progress > 0 && (
                        <div className="mt-2">
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-cyan-500 transition-all duration-300"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        type="button"
                        onClick={(e) => handleDelete(task.id, e)}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                        title="删除任务"
                        aria-label="删除任务"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <ChevronRight className="h-5 w-5 text-slate-300 transition-colors group-hover:text-primary-500" />
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
