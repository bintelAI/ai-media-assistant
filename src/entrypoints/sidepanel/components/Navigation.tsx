import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/shared/store';
import { LayoutDashboard, Database, ListTodo, Settings, Link, Loader2, LogIn, UserCircle } from 'lucide-react';
import { cn } from '@/shared/utils/helpers';
import { checkAuth, openDimensLoginPage, onDimensAuthChanged, type DimensAuth } from '@/shared/services/dimens-service';

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
  const [auth, setAuth] = useState<DimensAuth | null>(null);
  const [checking, setChecking] = useState(true);
  const [waitingLogin, setWaitingLogin] = useState(false);
  const loginTimeoutRef = useRef<number | null>(null);

  const clearLoginTimeout = () => {
    if (loginTimeoutRef.current) {
      window.clearTimeout(loginTimeoutRef.current);
      loginTimeoutRef.current = null;
    }
  };

  const startLoginTimeout = () => {
    clearLoginTimeout();
    loginTimeoutRef.current = window.setTimeout(() => {
      setWaitingLogin(false);
      setChecking(false);
      loginTimeoutRef.current = null;
    }, 60_000);
  };

  const refreshAuth = async () => {
    setChecking(true);
    try {
      setAuth(await checkAuth());
      setWaitingLogin(false);
    } catch {
      setAuth(null);
    } finally {
      clearLoginTimeout();
      setChecking(false);
      setWaitingLogin(false);
    }
  };

  useEffect(() => {
    refreshAuth();
    const unsubscribe = onDimensAuthChanged((event) => {
      if (event.status === 'checking') {
        setChecking(true);
        setWaitingLogin(event.reason === 'login-page-opened');
        return;
      }

      setChecking(false);
      clearLoginTimeout();
      if (event.status === 'authenticated') {
        setAuth((prev) => ({
          source: 'dimens-cookie',
          checkedAt: Date.now(),
          userInfo: event.userInfo ?? prev?.userInfo,
          teamIds: prev?.teamIds,
          cookieName: prev?.cookieName,
        }));
        setWaitingLogin(false);
        return;
      }

      setAuth(null);
      setWaitingLogin(false);
    });
    return () => {
      clearLoginTimeout();
      unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    if (checking || waitingLogin) return;
    if (auth) {
      await refreshAuth();
      return;
    }

    try {
      setWaitingLogin(true);
      setChecking(true);
      startLoginTimeout();
      await openDimensLoginPage();
    } catch {
      clearLoginTimeout();
      setWaitingLogin(false);
      setChecking(false);
    }
  };

  const displayName =
    auth?.userInfo?.nickname ||
    auth?.userInfo?.nickName ||
    auth?.userInfo?.name ||
    auth?.userInfo?.username ||
    auth?.userInfo?.phone ||
    '已登录';

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
        <button
          onClick={handleLogin}
          className={cn(
            'ml-2 flex max-w-[112px] items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
            auth
              ? 'bg-green-50 text-green-700 hover:bg-green-100'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          )}
          title={auth ? '刷新维表登录状态' : waitingLogin ? '等待维表登录完成' : '登录维表智联'}
        >
          {checking || waitingLogin ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : auth ? (
            <UserCircle className="h-3.5 w-3.5" />
          ) : (
            <LogIn className="h-3.5 w-3.5" />
          )}
          <span className="truncate">{checking || waitingLogin ? '登录中' : auth ? displayName : '登录'}</span>
        </button>
      </div>
    </nav>
  );
}
