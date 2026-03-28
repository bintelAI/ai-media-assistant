import { useEffect, useState } from 'react';
import { useUIStore, usePostsStore, useAuthorsStore, useCommentsStore, useTasksStore } from '@/shared/store';
import { 
  FileText, Users, MessageSquare, ListTodo, 
  Headphones, Globe, Lightbulb, BookOpen,
  Share2, ChevronRight, Sparkles
} from 'lucide-react';
import { formatDate, cn } from '@/shared/utils/helpers';

const platforms = [
  { id: 'pgy', name: '蒲公英', icon: '🌟', color: 'from-yellow-400 to-orange-500' },
  { id: 'xt', name: '星图', icon: '✈️', color: 'from-blue-400 to-indigo-500' },
  { id: 'xhs', name: '小红书', icon: '📕', color: 'from-red-400 to-pink-500' },
  { id: 'dy', name: '抖音', icon: '🎵', color: 'from-gray-800 to-black' }
];

const contactItems = [
  { icon: Headphones, name: '联系客服', bg: 'bg-amber-100', color: 'text-amber-600' },
  { icon: Globe, name: '查看官网', bg: 'bg-green-100', color: 'text-green-600' },
  { icon: Lightbulb, name: '提个需求', bg: 'bg-purple-100', color: 'text-purple-600' },
  { icon: BookOpen, name: '帮助文档', bg: 'bg-cyan-100', color: 'text-cyan-600' }
];

const announcements = [
  { title: '智联AI v1.0.0 正式发布', date: '2025-03-28', isNew: true },
  { title: '小红书数据采集功能上线', date: '2025-03-27', isNew: true },
  { title: '支持批量导出 Excel 格式', date: '2025-03-26', isNew: false },
  { title: '优化数据采集性能', date: '2025-03-25', isNew: false }
];

export default function Overview() {
  const { setCurrentPage, setCurrentDataTab } = useUIStore();
  const { posts, fetchPosts, countPosts } = usePostsStore();
  const { authors, fetchAuthors } = useAuthorsStore();
  const { comments, fetchComments } = useCommentsStore();
  const { tasks, fetchTasks } = useTasksStore();
  const [todayCount, setTodayCount] = useState(0);
  const [carouselIndex, setCarouselIndex] = useState(0);

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

  useEffect(() => {
    const timer = setInterval(() => {
      setCarouselIndex(prev => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleNavigate = (page: 'data' | 'tasks', tab?: 'posts' | 'authors' | 'comments') => {
    setCurrentPage(page);
    if (tab) {
      setCurrentDataTab(tab);
    }
  };

  const recentTasks = tasks.slice(0, 3);

  const carouselItems = [
    { title: '欢迎使用智联AI', desc: '一键采集社媒数据，轻松导出分析' },
    { title: '支持多平台', desc: '小红书、抖音、快手等主流平台' },
    { title: '数据安全', desc: '所有数据本地存储，隐私有保障' }
  ];

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg">智联AI</span>
              <p className="text-xs text-gray-400">数据采集助手</p>
            </div>
          </div>
          <div className="text-xs text-gray-400 bg-white px-3 py-1.5 rounded-full shadow-sm">
            v1.0.0
          </div>
        </div>

        <div className="relative h-32 bg-gradient-to-r from-primary-500 to-purple-600 rounded-xl overflow-hidden shadow-lg">
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="text-center text-white">
              <p className="font-medium text-lg">{carouselItems[carouselIndex].title}</p>
              <p className="text-sm opacity-80 mt-1">{carouselItems[carouselIndex].desc}</p>
            </div>
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {carouselItems.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-all',
                  i === carouselIndex ? 'bg-white w-4' : 'bg-white/50'
                )}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: '今日采集', value: todayCount, icon: FileText, color: 'text-primary-500', bg: 'bg-primary-50', onClick: () => handleNavigate('data', 'posts') },
            { label: '帖子总数', value: posts.length, icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50', onClick: () => handleNavigate('data', 'posts') },
            { label: '作者总数', value: authors.length, icon: Users, color: 'text-green-500', bg: 'bg-green-50', onClick: () => handleNavigate('data', 'authors') },
            { label: '评论总数', value: comments.length, icon: MessageSquare, color: 'text-orange-500', bg: 'bg-orange-50', onClick: () => handleNavigate('data', 'comments') }
          ].map((stat) => (
            <div
              key={stat.label}
              onClick={stat.onClick}
              className="bg-white rounded-xl p-3 text-center shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className={cn('w-8 h-8 rounded-lg mx-auto flex items-center justify-center', stat.bg)}>
                <stat.icon className={cn('w-4 h-4', stat.color)} />
              </div>
              <p className="text-lg font-bold mt-2">{stat.value}</p>
              <p className="text-xs text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium">支持平台</span>
            <span className="text-xs text-gray-400">点击切换</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {platforms.map((platform) => (
              <div
                key={platform.id}
                className="flex flex-col items-center gap-2 cursor-pointer group"
              >
                <div className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm',
                  'group-hover:shadow-md transition-shadow',
                  `bg-gradient-to-br ${platform.color}`
                )}>
                  {platform.icon}
                </div>
                <span className="text-xs text-gray-600 group-hover:text-gray-900">{platform.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">最近任务</h3>
            <button
              onClick={() => handleNavigate('tasks')}
              className="text-xs text-primary-500 flex items-center gap-1"
            >
              查看全部
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {recentTasks.length === 0 ? (
            <div className="text-center py-4 text-gray-400 text-sm">
              暂无任务记录
            </div>
          ) : (
            <div className="space-y-2">
              {recentTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'w-2 h-2 rounded-full',
                      task.status === 'success' ? 'bg-green-500' :
                      task.status === 'failed' ? 'bg-red-500' :
                      task.status === 'running' ? 'bg-blue-500 animate-pulse' :
                      'bg-gray-300'
                    )} />
                    <span className="text-sm">{task.title || task.taskType}</span>
                  </div>
                  <span className="text-xs text-gray-400">{formatDate(task.createdAt, 'MM-dd HH:mm')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-medium mb-3">快捷功能</h3>
          <div className="grid grid-cols-2 gap-3">
            {contactItems.map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', item.bg)}>
                  <item.icon className={cn('w-5 h-5', item.color)} />
                </div>
                <span className="text-sm font-medium">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">公告</h3>
            <span className="text-xs text-gray-400">更多</span>
          </div>
          <div className="space-y-2">
            {announcements.map((announcement, index) => (
              <div key={index} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  {announcement.isNew && (
                    <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded">新</span>
                  )}
                  <span className="text-sm text-gray-700">{announcement.title}</span>
                </div>
                <span className="text-xs text-gray-400">{announcement.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-100 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-500">
            <Share2 className="w-4 h-4" />
            <span className="text-sm">觉得不错？分享给小伙伴</span>
          </div>
          <button className="bg-gradient-to-r from-primary-500 to-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:shadow-lg transition-shadow">
            立即分享
          </button>
        </div>
      </div>
    </div>
  );
}
