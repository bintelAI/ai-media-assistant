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
  { id: 'settings', label: '设置', icon: Settings }
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
    <nav className="border-b border-slate-200 bg-white">
      <div className="flex h-12 items-center justify-between gap-3 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50">
            <img src="/icon/32.png" alt="智联AI" className="h-6 w-6 rounded" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-950">智联AI</div>
            <div className="truncate text-[11px] text-slate-500">采集助手</div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogin}
          className={cn(
            'flex min-h-[36px] max-w-[144px] shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
            auth
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            (checking || waitingLogin) && 'cursor-wait'
          )}
          title={auth ? '刷新维表登录状态' : waitingLogin ? '等待维表登录完成' : '登录维表智联'}
          aria-label={auth ? `维表智联已登录，${displayName}` : waitingLogin ? '等待维表智联登录完成' : '登录维表智联'}
        >
          {checking || waitingLogin ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : auth ? (
            <UserCircle className="h-4 w-4 shrink-0" />
          ) : (
            <LogIn className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate">{checking || waitingLogin ? '登录中' : auth ? displayName : '登录'}</span>
        </button>
      </div>

      <div className="grid grid-cols-5 gap-1 border-t border-slate-100 px-2 py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCurrentPage(item.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-h-[38px] items-center justify-center gap-1 rounded-md px-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
                active
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
