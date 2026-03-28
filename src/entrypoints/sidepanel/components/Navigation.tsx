import { useUIStore } from '@/shared/store';
import { LayoutDashboard, Database, ListTodo, Download, Settings } from 'lucide-react';
import { cn } from '@/shared/utils/helpers';

const navItems = [
  { id: 'overview', label: '总览', icon: LayoutDashboard },
  { id: 'data', label: '数据', icon: Database },
  { id: 'tasks', label: '任务', icon: ListTodo },
  { id: 'downloads', label: '下载', icon: Download },
  { id: 'settings', label: '设置', icon: Settings }
] as const;

export default function Navigation() {
  const { currentPage, setCurrentPage } = useUIStore();

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-lg font-bold text-primary-600 mr-4">智联采集</span>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  currentPage === item.id
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
