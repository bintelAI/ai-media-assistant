import { useUIStore } from '@/shared/store';
import { FileText, Users, MessageSquare, Image } from 'lucide-react';
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
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentDataTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  currentDataTab === tab.id
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-100'
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
