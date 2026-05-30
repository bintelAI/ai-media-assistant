import { useUIStore } from '@/shared/store';
import { FileText, Users, MessageSquare } from 'lucide-react';
import { cn } from '@/shared/utils/helpers';
import PostsList from './PostsList';
import AuthorsList from './AuthorsList';
import CommentsList from './CommentsList';

const tabs = [
  { id: 'posts', label: '帖子', icon: FileText },
  { id: 'authors', label: '作者', icon: Users },
  { id: 'comments', label: '评论', icon: MessageSquare }
] as const;

export default function DataPage() {
  const { currentDataTab, setCurrentDataTab } = useUIStore();

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm shadow-slate-200/60">
        <div className="mb-2">
          <h1 className="text-base font-semibold text-slate-950">数据资产</h1>
          <p className="text-xs text-slate-500">查看采集内容，并按类型导出或入库</p>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentDataTab(tab.id)}
                className={cn(
                  'flex min-h-[40px] items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
                  currentDataTab === tab.id
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:bg-white/70 hover:text-slate-950'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        {currentDataTab === 'posts' && <PostsList />}
        {currentDataTab === 'authors' && <AuthorsList />}
        {currentDataTab === 'comments' && <CommentsList />}
      </div>
    </div>
  );
}
