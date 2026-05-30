import { useEffect, useState } from 'react';
import { useUIStore, usePostsStore, useAuthorsStore, useCommentsStore, useTasksStore, useSettingsStore } from '@/shared/store';
import {
  FileText,
  Users,
  MessageSquare,
  BookOpen,
  ChevronRight,
  CheckCircle2,
  CircleSlash,
  Clock3,
  Store,
  Music2,
  BarChart3,
  Activity,
  UploadCloud,
  Link,
  Settings,
  ArrowUpRight,
  PlayCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatDate, cn } from '@/shared/utils/helpers';
import { PLATFORM_FEATURES } from '@/shared/utils/constants';
import type { PlatformFeatureKey } from '@/shared/utils/constants';

const platforms: Array<{
  id: PlatformFeatureKey;
  name: string;
  icon: LucideIcon;
  markClass: string;
  note: string;
}> = [
  { id: 'xhs', name: PLATFORM_FEATURES.xhs.label, icon: BookOpen, markClass: 'bg-rose-50 text-rose-600 ring-rose-100', note: '作者主页采集' },
  { id: 'douyin', name: PLATFORM_FEATURES.douyin.label, icon: Music2, markClass: 'bg-slate-100 text-slate-900 ring-slate-200', note: '功能验收中' },
  { id: 'pgy', name: PLATFORM_FEATURES.pgy.label, icon: Store, markClass: 'bg-amber-50 text-amber-700 ring-amber-100', note: '暂未支持' },
  { id: 'xingtu', name: PLATFORM_FEATURES.xingtu.label, icon: BarChart3, markClass: 'bg-sky-50 text-sky-700 ring-sky-100', note: '暂未支持' },
];

export default function Overview() {
  const { setCurrentPage, setCurrentDataTab, showToast } = useUIStore();
  const { posts, fetchPosts } = usePostsStore();
  const { authors, fetchAuthors } = useAuthorsStore();
  const { comments, fetchComments } = useCommentsStore();
  const { tasks, fetchTasks } = useTasksStore();
  const { devMode } = useSettingsStore();
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    fetchPosts();
    fetchAuthors();
    fetchComments();
    fetchTasks();
  }, []);

  useEffect(() => {
    const count = posts.filter(p => {
      const collectDate = new Date(p.collectedAt).toDateString();
      const today = new Date().toDateString();
      return collectDate === today;
    }).length;
    setTodayCount(count);
  }, [posts]);

  const handleNavigate = (page: 'data' | 'tasks' | 'batchCollect' | 'settings', tab?: 'posts' | 'authors' | 'comments') => {
    setCurrentPage(page);
    if (tab) {
      setCurrentDataTab(tab);
    }
  };

  const handlePlatformClick = (platformId: PlatformFeatureKey) => {
    const feature = PLATFORM_FEATURES[platformId];
    if (feature.status !== 'enabled' && !devMode) {
      showToast(`${feature.label}暂未支持`, 'info');
      return;
    }
    window.open(feature.url, '_blank');
  };

  const recentTasks = tasks.slice(0, 3);
  const runningTasks = tasks.filter(task => task.status === 'running').length;

  const statCards = [
    { label: '今日', value: todayCount, icon: Activity, tone: 'text-blue-600', onClick: () => handleNavigate('data', 'posts') },
    { label: '帖子', value: posts.length, icon: FileText, tone: 'text-cyan-600', onClick: () => handleNavigate('data', 'posts') },
    { label: '作者', value: authors.length, icon: Users, tone: 'text-emerald-600', onClick: () => handleNavigate('data', 'authors') },
    { label: '评论', value: comments.length, icon: MessageSquare, tone: 'text-amber-600', onClick: () => handleNavigate('data', 'comments') },
  ];

  const quickActions = [
    { label: '批量采集', desc: '粘贴链接批量抓取', icon: Link, tone: 'text-blue-600 bg-blue-50', onClick: () => handleNavigate('batchCollect') },
    { label: '查看数据', desc: '导出或入库', icon: UploadCloud, tone: 'text-emerald-600 bg-emerald-50', onClick: () => handleNavigate('data', 'posts') },
    { label: '任务队列', desc: runningTasks > 0 ? `${runningTasks} 个进行中` : '查看执行记录', icon: PlayCircle, tone: 'text-amber-600 bg-amber-50', onClick: () => handleNavigate('tasks') },
    { label: '入库配置', desc: '团队/项目/表', icon: Settings, tone: 'text-slate-600 bg-slate-100', onClick: () => handleNavigate('settings') },
  ];

  return (
    <div className="h-full overflow-auto bg-transparent">
      <div className="space-y-3 p-3">
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-3">
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-slate-950">工作台</h1>
              <p className="mt-0.5 text-xs text-slate-500">小红书采集，维表智联入库</p>
            </div>
            <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
              在线
            </span>
          </div>
          <div className="grid grid-cols-4 divide-x divide-slate-100">
            {statCards.map((stat) => (
              <button
                key={stat.label}
                type="button"
                onClick={stat.onClick}
                className="min-h-[68px] px-2 py-2 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset"
              >
                <stat.icon className={cn('h-4 w-4', stat.tone)} />
                <p className="mt-1 text-xl font-semibold tabular-nums text-slate-950">{stat.value}</p>
                <p className="text-[11px] text-slate-500">{stat.label}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="flex min-h-[72px] items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', action.tone)}>
                <action.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{action.label}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{action.desc}</p>
              </div>
            </button>
          ))}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">平台入口</h2>
              <p className="text-xs text-slate-500">支持状态一眼看清</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {platforms.map((platform) => {
              const feature = PLATFORM_FEATURES[platform.id];
              const enabled = feature.status === 'enabled' || devMode;
              const statusText = feature.status === 'enabled' ? '可用' : devMode ? 'Dev' : '暂未支持';
              const StatusIcon = feature.status === 'enabled' ? CheckCircle2 : devMode ? Clock3 : CircleSlash;
              const PlatformIcon = platform.icon;

              return (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => handlePlatformClick(platform.id)}
                  className={cn(
                    'flex min-h-[48px] w-full items-center justify-between gap-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset',
                    enabled
                      ? 'hover:bg-slate-50'
                      : 'cursor-not-allowed opacity-55'
                  )}
                  title={enabled ? `打开${platform.name}` : `${platform.name}暂未支持`}
                  aria-disabled={!enabled}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md ring-1', enabled ? platform.markClass : 'bg-slate-100 text-slate-400 ring-slate-200')}>
                      <PlatformIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className={cn('truncate text-sm font-medium', enabled ? 'text-slate-900' : 'text-slate-500')}>{platform.name}</p>
                      <p className="truncate text-xs text-slate-500">{enabled ? platform.note : (feature.disabledReason || platform.note)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium',
                        feature.status === 'enabled'
                          ? 'bg-green-50 text-green-700'
                          : devMode
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-200 text-slate-500'
                      )}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {statusText}
                    </span>
                    {enabled && <ArrowUpRight className="h-3.5 w-3.5 text-slate-300" />}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">最近任务</h2>
            <button
              type="button"
              onClick={() => handleNavigate('tasks')}
              className="flex min-h-[32px] items-center gap-1 rounded-md px-2 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              查看全部
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {recentTasks.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
              暂无任务记录
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn(
                      'h-2 w-2 shrink-0 rounded-full',
                      task.status === 'success' ? 'bg-green-500' :
                        task.status === 'failed' ? 'bg-red-500' :
                          task.status === 'running' ? 'bg-blue-500 animate-pulse' :
                            'bg-gray-300'
                    )} />
                    <span className="truncate text-sm text-slate-800">{task.title || task.taskType}</span>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{formatDate(task.createdAt, 'MM-dd HH:mm')}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
