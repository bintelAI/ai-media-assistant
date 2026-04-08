import { useUIStore } from '@/shared/store';
import { LayoutDashboard, Database, ListTodo, Download, Settings, Link } from 'lucide-react';
import { cn } from '@/shared/utils/helpers';

const navItems = [
  { id: 'overview', label: '总览', icon: LayoutDashboard },
  { id: 'data', label: '数据', icon: Database },
  { id: 'tasks', label: '任务', icon: ListTodo },
  { id: 'batchCollect', label: '批量', icon: Link },
  // { id: 'downloads', label: '下载', icon: Download },
  { id: 'settings', label: '', icon: Settings }
] as const;

export default function Navigation() {
  const { currentPage, setCurrentPage } = useUIStore();

  return (
    <nav className="bg-white border-b border-gray-200 px-3 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors',
                  currentPage === item.id
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label && <span>{item.label}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
