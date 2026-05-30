import { useSettingsStore } from '@/shared/store';
import { Trash2, RotateCcw, Database, CheckCircle2, XCircle, Plus, RefreshCw, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { clearPosts, clearAuthors, clearComments, clearTasks } from '@/shared/db';
import {
  checkAuth,
  checkConnection,
  clearSheetTarget,
  getConfig,
  saveConfig,
  getTeamIds,
  listProjects,
  listSheets,
  listColumns,
  createNewProject,
  createStandardSheetForType,
  ensureColumns,
  getProjectInfo,
  getSheetConfig,
  openDimensLoginPage,
  logout,
  onDimensAuthChanged,
  saveSheetTarget,
  DEFAULT_TEAM_ID,
  DEFAULT_PROJECT_NAME,
  type DimensSheet,
  type DimensSheetTarget,
  type SheetType,
} from '@/shared/services/dimens-service';

const SHEET_TYPE_LABELS: Record<SheetType, string> = {
  posts: '帖子',
  authors: '作者',
  comments: '评论',
};

export default function Settings() {
  const {
    defaultExportFormat,
    autoDedupe,
    autoOpenSidePanel,
    taskConcurrency,
    retryCount,
    devMode,
    collectIntervalMinMs,
    collectIntervalMaxMs,
    updateSettings,
    resetSettings
  } = useSettingsStore();

  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected' | 'error'>('checking');
  const [statusMessage, setStatusMessage] = useState('');

  // Team/Project config
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [currentTeamId, setCurrentTeamId] = useState(DEFAULT_TEAM_ID);
  const [currentProjectId, setCurrentProjectId] = useState('');
  const [currentProjectName, setCurrentProjectName] = useState(DEFAULT_PROJECT_NAME);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedSheetType, setSelectedSheetType] = useState<SheetType>('posts');
  const [sheets, setSheets] = useState<DimensSheet[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState('');
  const [selectedSheetTarget, setSelectedSheetTarget] = useState<DimensSheetTarget | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [updatingSheet, setUpdatingSheet] = useState(false);
  const [fieldStatus, setFieldStatus] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newSheetName, setNewSheetName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);

  const sheetConfig = getSheetConfig(selectedSheetType);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const config = await getConfig();
    setCurrentTeamId(config.teamId);
    setCurrentProjectId(config.projectId || '');
    setCurrentProjectName(config.projectName || DEFAULT_PROJECT_NAME);
    syncSheetTargetFromConfig(selectedSheetType, config);
    checkConn();
  };

  useEffect(() => {
    return onDimensAuthChanged((event) => {
      if (event.status === 'checking') {
        setConnectionStatus('checking');
        setStatusMessage(event.reason === 'login-page-opened' ? '等待维表网页登录完成...' : '正在检查维表登录状态...');
        return;
      }

      if (event.status === 'authenticated') {
        checkConn();
        return;
      }

      setConnectionStatus('disconnected');
      setStatusMessage(event.error || '未登录维表智联');
      setTeamIds([]);
      setProjects([]);
      setSheets([]);
      setSelectedSheetId('');
      setSelectedSheetTarget(null);
      setFieldStatus('');
    });
  }, []);

  const loadProjects = async (teamId?: string) => {
    setLoadingProjects(true);
    try {
      const list = await listProjects(teamId);
      setProjects(list);
    } catch {
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadSheets = async (projectId?: string) => {
    if (!projectId) {
      setSheets([]);
      return;
    }

    setLoadingSheets(true);
    try {
      const list = await listSheets(projectId);
      setSheets(list);
    } catch {
      setSheets([]);
    } finally {
      setLoadingSheets(false);
    }
  };

  const syncSheetTargetFromConfig = (sheetType: SheetType, config: Awaited<ReturnType<typeof getConfig>>) => {
    const target = config.sheetTargets?.[sheetType] || null;
    setSelectedSheetTarget(target);
    setSelectedSheetId(target?.sheetId || '');
  };

  const checkConn = async () => {
    setConnectionStatus('checking');
    try {
      const auth = await checkAuth();
      const tids = await getTeamIds();
      setTeamIds(tids.length > 0 ? tids : auth.teamIds || []);
      const result = await checkConnection();
      setConnectionStatus(result.ok ? 'connected' : 'error');
      setStatusMessage(result.message);
      if (!result.ok) return;

      await getProjectInfo();
      const config = await getConfig();
      setCurrentTeamId(config.teamId);
      setCurrentProjectId(config.projectId || '');
      setCurrentProjectName(config.projectName || DEFAULT_PROJECT_NAME);
      syncSheetTargetFromConfig(selectedSheetType, config);
      await loadProjects(config.teamId);
      await loadSheets(config.projectId);
    } catch (e: any) {
      setConnectionStatus('disconnected');
      setStatusMessage(e.message || '未登录维表智联');
      setSheets([]);
      setSelectedSheetId('');
      setSelectedSheetTarget(null);
      setFieldStatus('');
    }
  };

  const handleRefresh = async () => {
    try {
      await checkConn();
    } catch (e: any) {
      setConnectionStatus('error');
      setStatusMessage(e.message || '重新连接失败');
    }
  };

  const handleOpenWebLogin = async () => {
    try {
      setConnectionStatus('checking');
      setStatusMessage('等待维表网页登录完成...');
      await openDimensLoginPage();
    } catch (e: any) {
      setConnectionStatus('error');
      setStatusMessage(e.message || '打开维表登录页失败');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setConnectionStatus('disconnected');
      setStatusMessage('已退出维表智联');
      setTeamIds([]);
      setProjects([]);
      setSheets([]);
      setSelectedSheetId('');
      setSelectedSheetTarget(null);
      setFieldStatus('');
    } catch (e: any) {
      setConnectionStatus('error');
      setStatusMessage(e.message || '退出登录失败');
    }
  };

  const handleTeamChange = async (newTeamId: string) => {
    setCurrentTeamId(newTeamId);
    setCurrentProjectId('');
    setCurrentProjectName(DEFAULT_PROJECT_NAME);
    setSheets([]);
    setSelectedSheetId('');
    setSelectedSheetTarget(null);
    setFieldStatus('');
    await saveConfig({ teamId: newTeamId, projectName: DEFAULT_PROJECT_NAME, sheetTargets: {} });
    await loadProjects(newTeamId);
  };

  const handleProjectSelect = async (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    setCurrentProjectId(project.id);
    setCurrentProjectName(project.name);
    setSelectedSheetId('');
    setSelectedSheetTarget(null);
    setFieldStatus('');
    await saveConfig({ teamId: currentTeamId, projectId: project.id, projectName: project.name, sheetTargets: {} });
    await loadSheets(project.id);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const project = await createNewProject(newProjectName.trim());
      setCurrentProjectId(project.id);
      setCurrentProjectName(project.name);
      setSelectedSheetId('');
      setSelectedSheetTarget(null);
      setFieldStatus('');
      await saveConfig({ teamId: currentTeamId, projectId: project.id, projectName: project.name, sheetTargets: {} });
      setNewProjectName('');
      setShowNewProject(false);
      await loadProjects();
      await loadSheets(project.id);
    } catch (e: any) {
      alert('创建项目失败：' + (e.message || '未知错误'));
    }
  };

  const handleSheetTypeChange = async (sheetType: SheetType) => {
    setSelectedSheetType(sheetType);
    setFieldStatus('');
    const config = await getConfig();
    syncSheetTargetFromConfig(sheetType, config);
    if (config.projectId) {
      await loadSheets(config.projectId);
    }
  };

  const handleSheetSelect = async (sheetId: string) => {
    if (!sheetId) {
      setSelectedSheetId('');
      setSelectedSheetTarget(null);
      setFieldStatus('');
      await clearSheetTarget(selectedSheetType);
      return;
    }

    const sheet = sheets.find((item) => item.sheetId === sheetId);
    if (!sheet) return;

    setSelectedSheetId(sheet.sheetId);
    setFieldStatus('正在读取字段...');
    setUpdatingSheet(true);
    try {
      const target = await saveSheetTarget(selectedSheetType, sheet);
      setSelectedSheetTarget(target);
      const missingKeys = sheetConfig.primaryKeys.filter((key) => !target.fieldMapping[key]);
      const matchedCount = Object.keys(target.fieldMapping).length;
      setFieldStatus(missingKeys.length > 0
        ? `已匹配 ${matchedCount} 个字段，缺少主键字段：${missingKeys.join('、')}`
        : `已匹配 ${matchedCount} 个字段，可按主键新增或更新`);
    } catch (e: any) {
      setFieldStatus(e.message || '读取字段失败');
    } finally {
      setUpdatingSheet(false);
    }
  };

  const handleEnsureColumns = async () => {
    if (!currentProjectId || !selectedSheetId) return;

    try {
      setUpdatingSheet(true);
      setFieldStatus('正在补齐标准字段...');
      const ensured = await ensureColumns(currentTeamId, currentProjectId, selectedSheetId, selectedSheetType);
      const sheet = sheets.find((item) => item.sheetId === selectedSheetId);
      if (sheet) {
        const columns = await listColumns(currentTeamId, currentProjectId, selectedSheetId);
        const target = await saveSheetTarget(selectedSheetType, { ...sheet, columns });
        setSelectedSheetTarget(target);
      }
      setFieldStatus(ensured.missing.length > 0
        ? `仍缺少字段：${ensured.missing.join('、')}`
        : `字段已补齐，新增字段 ${ensured.created.length} 个`);
    } catch (e: any) {
      setFieldStatus(e.message || '补齐字段失败');
    } finally {
      setUpdatingSheet(false);
    }
  };

  const handleCreateStandardSheet = async () => {
    try {
      setUpdatingSheet(true);
      setFieldStatus('正在创建标准表...');
      const target = await createStandardSheetForType(selectedSheetType, newSheetName);
      setSelectedSheetTarget(target);
      setSelectedSheetId(target.sheetId);
      setNewSheetName('');
      const config = await getConfig();
      setCurrentTeamId(config.teamId);
      setCurrentProjectId(config.projectId || '');
      setCurrentProjectName(config.projectName || DEFAULT_PROJECT_NAME);
      await loadProjects(config.teamId);
      await loadSheets(config.projectId);
      setFieldStatus('标准表已创建并补齐字段');
    } catch (e: any) {
      setFieldStatus(e.message || '创建标准表失败');
    } finally {
      setUpdatingSheet(false);
    }
  };

  const handleClearPosts = async () => {
    if (confirm('确定要清空所有帖子数据吗？此操作不可恢复。')) {
      await clearPosts();
      alert('帖子数据已清空');
    }
  };

  const handleClearAuthors = async () => {
    if (confirm('确定要清空所有作者数据吗？此操作不可恢复。')) {
      await clearAuthors();
      alert('作者数据已清空');
    }
  };

  const handleClearComments = async () => {
    if (confirm('确定要清空所有评论数据吗？此操作不可恢复。')) {
      await clearComments();
      alert('评论数据已清空');
    }
  };

  const handleClearAll = async () => {
    if (confirm('确定要清空所有数据吗？此操作不可恢复。')) {
      await Promise.all([
        clearPosts(),
        clearAuthors(),
        clearComments(),
        clearTasks()
      ]);
      alert('所有数据已清空');
    }
  };

  const handleResetSettings = () => {
    if (confirm('确定要重置所有设置吗？')) {
      resetSettings();
    }
  };

  const connectionIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      case 'error': return <XCircle className="h-4 w-4 text-rose-600" />;
      case 'checking': return <Database className="h-4 w-4 text-slate-400" />;
      default: return <XCircle className="h-4 w-4 text-slate-400" />;
    }
  };

  const connectionLabel = () => {
    switch (connectionStatus) {
      case 'connected': return '已连接';
      case 'error': return '连接失败';
      case 'checking': return '检测中...';
      default: return '未连接';
    }
  };

  return (
    <div className="h-full overflow-auto bg-transparent p-4 space-y-4">
      {/* 维表智联配置 */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
        <div className="border-b border-slate-200 bg-slate-950 px-4 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-cyan-200">
              <Database className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold">维表智联数据仓库</h3>
              <p className="text-xs text-slate-400">配置团队、项目与默认入库表</p>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
            <div>
                <p className="text-sm font-semibold text-slate-900">连接状态</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">{statusMessage}</p>
            </div>
            <div className="flex items-center gap-2">
              {connectionIcon()}
                <span className={`text-sm font-medium ${connectionStatus === 'connected' ? 'text-emerald-700' : connectionStatus === 'error' ? 'text-rose-700' : 'text-slate-500'}`}>
                {connectionLabel()}
              </span>
              {connectionStatus !== 'checking' && (
                <button
                  onClick={handleRefresh}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  title="刷新连接"
                    aria-label="刷新连接"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            </div>
          </div>
          {connectionStatus !== 'connected' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={handleOpenWebLogin}
                  disabled={connectionStatus === 'checking'}
                  className="min-h-[44px] flex-1 rounded-md bg-slate-950 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                >
                  {connectionStatus === 'checking' ? '登录中...' : '登录维表智联'}
                </button>
              </div>
              <p className="text-xs leading-5 text-amber-800">网页登录成功后，插件会监听维表 Cookie 写入并自动确认登录状态。</p>
            </div>
          )}

          {/* Team / Project config - shown when connected */}
          {connectionStatus === 'connected' && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/50">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">团队 ID</label>
                {teamIds.length > 0 ? (
                  <div className="relative">
                    <select
                      value={currentTeamId}
                      onChange={(e) => handleTeamChange(e.target.value)}
                      className="min-h-[40px] w-full appearance-none rounded-md border border-slate-300 bg-white px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {teamIds.map((tid) => (
                        <option key={tid} value={tid}>{tid}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={currentTeamId}
                    onChange={(e) => setCurrentTeamId(e.target.value)}
                    onBlur={() => handleTeamChange(currentTeamId)}
                    placeholder="输入团队ID"
                    className="min-h-[40px] w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">项目</label>
                {loadingProjects ? (
                  <p className="py-1.5 text-xs text-slate-500">加载中...</p>
                ) : projects.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <select
                        value={currentProjectId || currentProjectName}
                        onChange={(e) => handleProjectSelect(e.target.value)}
                        className="min-h-[40px] w-full appearance-none rounded-md border border-slate-300 bg-white px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                    <button
                      onClick={() => setShowNewProject(!showNewProject)}
                      className="flex min-h-[32px] items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                    >
                      <Plus className="h-3 w-3" />
                      {showNewProject ? '取消创建' : '创建新项目'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={currentProjectName}
                      onChange={(e) => setCurrentProjectName(e.target.value)}
                      onBlur={async () => {
                        setCurrentProjectId('');
                        setSelectedSheetId('');
                        setSelectedSheetTarget(null);
                        setSheets([]);
                        setFieldStatus('');
                        await saveConfig({ teamId: currentTeamId, projectId: undefined, projectName: currentProjectName, sheetTargets: {} });
                      }}
                      placeholder="输入项目名称"
                      className="min-h-[40px] w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="text-xs text-slate-400">未找到项目，可输入名称自动创建</p>
                  </div>
                )}
              </div>

              {showNewProject && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="新项目名称"
                    className="min-h-[40px] flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                  />
                  <button
                    onClick={handleCreateProject}
                    disabled={!newProjectName.trim()}
                    className="min-h-[40px] rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    创建
                  </button>
                </div>
              )}

              <div className="space-y-3 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">默认入库表</p>
                    <p className="text-xs leading-5 text-slate-500">按数据类型分别保存目标表，入库弹窗会复用这里的配置</p>
                  </div>
                  <select
                    value={selectedSheetType}
                    onChange={(e) => handleSheetTypeChange(e.target.value as SheetType)}
                    className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="posts">帖子</option>
                    <option value="authors">作者</option>
                    <option value="comments">评论</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{SHEET_TYPE_LABELS[selectedSheetType]}目标表</label>
                  {loadingSheets ? (
                    <p className="py-1.5 text-xs text-slate-500">正在加载表...</p>
                  ) : currentProjectId ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <select
                          value={selectedSheetId}
                          disabled={updatingSheet}
                          onChange={(e) => handleSheetSelect(e.target.value)}
                          className="min-h-[40px] w-full appearance-none rounded-md border border-slate-300 bg-white px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                        >
                          <option value="">请选择已有表</option>
                          {selectedSheetTarget && !sheets.some((sheet) => sheet.sheetId === selectedSheetTarget.sheetId) && (
                            <option value={selectedSheetTarget.sheetId}>{selectedSheetTarget.sheetName}</option>
                          )}
                          {sheets.map((sheet) => (
                            <option key={sheet.sheetId} value={sheet.sheetId}>{sheet.name || sheet.sheetId}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      </div>

                      <input
                        type="text"
                        value={newSheetName}
                        onChange={(e) => setNewSheetName(e.target.value)}
                        placeholder={`新建表名称，默认：${sheetConfig.name}`}
                        className="min-h-[40px] w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />

                      <div className="flex gap-2">
                        <button
                          onClick={handleCreateStandardSheet}
                          disabled={updatingSheet}
                          className="min-h-[40px] flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                        >
                          创建标准表
                        </button>
                        <button
                          onClick={handleEnsureColumns}
                          disabled={!selectedSheetId || updatingSheet}
                          className="min-h-[40px] flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                        >
                          补齐标准字段
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="py-1.5 text-xs text-slate-400">请先选择项目后再选择目标表</p>
                  )}
                </div>

                {selectedSheetTarget && (
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                    <p className="text-xs font-medium text-emerald-700">当前默认表</p>
                    <p className="text-sm font-semibold text-slate-900">{selectedSheetTarget.sheetName}</p>
                    <p className="mt-0.5 text-xs text-emerald-700">主键：{selectedSheetTarget.upsertKeys.join(' + ')}</p>
                  </div>
                )}

                {fieldStatus && (
                  <p className="rounded-md bg-slate-50 px-2 py-1.5 text-xs leading-5 text-slate-500">{fieldStatus}</p>
                )}
              </div>
            </div>
          )}

          {connectionStatus === 'connected' && (
            <button
              onClick={handleLogout}
              className="min-h-[44px] w-full rounded-md border border-rose-200 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
            >
              退出维表登录
            </button>
          )}
        </div>
      </div>

      {/* 基础设置 */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">基础设置</h3>
          <p className="mt-0.5 text-xs text-slate-500">导出、去重与侧栏行为</p>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">默认导出格式</p>
              <p className="text-xs text-slate-500">选择导出数据的默认格式</p>
            </div>
            <select
              value={defaultExportFormat}
              onChange={(e) => updateSettings({ defaultExportFormat: e.target.value as 'csv' | 'excel' | 'json' })}
              className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="excel">Excel</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">自动去重</p>
              <p className="text-xs text-slate-500">采集时自动跳过已存在的数据</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoDedupe}
                onChange={(e) => updateSettings({ autoDedupe: e.target.checked })}
                className="sr-only peer"
              />
              <div className="h-5 w-9 rounded-full bg-slate-200 peer peer-checked:bg-primary-500 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">采集后自动打开侧栏</p>
              <p className="text-xs text-slate-500">采集完成后自动打开 Side Panel</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoOpenSidePanel}
                onChange={(e) => updateSettings({ autoOpenSidePanel: e.target.checked })}
                className="sr-only peer"
              />
              <div className="h-5 w-9 rounded-full bg-slate-200 peer peer-checked:bg-primary-500 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">开发模式</p>
              <p className="text-xs text-slate-500">仅用于内部调试未开放平台入口</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={devMode}
                onChange={(e) => updateSettings({ devMode: e.target.checked })}
                className="sr-only peer"
              />
              <div className="h-5 w-9 rounded-full bg-slate-200 peer peer-checked:bg-primary-500 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </label>
          </div>
        </div>
      </div>

      {/* 任务设置 */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">任务设置</h3>
          <p className="mt-0.5 text-xs text-slate-500">控制批量采集节奏与失败重试</p>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">并发数</p>
              <p className="text-xs text-slate-500">同时执行的任务数量</p>
            </div>
            <input
              type="number"
              min={1}
              max={5}
              value={taskConcurrency}
              onChange={(e) => updateSettings({ taskConcurrency: parseInt(e.target.value) })}
              className="min-h-[40px] w-16 rounded-md border border-slate-300 px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">重试次数</p>
              <p className="text-xs text-slate-500">任务失败后的重试次数</p>
            </div>
            <input
              type="number"
              min={0}
              max={5}
              value={retryCount}
              onChange={(e) => updateSettings({ retryCount: parseInt(e.target.value) })}
              className="min-h-[40px] w-16 rounded-md border border-slate-300 px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">批量采集间隔</p>
                <p className="text-xs text-slate-500">每条 URL 之间随机等待，降低连续访问风险</p>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={Math.round(collectIntervalMinMs / 1000)}
                  onChange={(e) => {
                    const seconds = Math.max(1, Number(e.target.value) || 1);
                    const minMs = seconds * 1000;
                    updateSettings({
                      collectIntervalMinMs: minMs,
                      collectIntervalMaxMs: Math.max(minMs, collectIntervalMaxMs)
                    });
                  }}
                  className="min-h-[40px] w-16 rounded-md border border-slate-300 px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label="批量采集最小间隔秒数"
                />
                <span className="text-xs text-slate-400">-</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={Math.round(collectIntervalMaxMs / 1000)}
                  onChange={(e) => {
                    const seconds = Math.max(1, Number(e.target.value) || 1);
                    const maxMs = seconds * 1000;
                    updateSettings({
                      collectIntervalMinMs: Math.min(collectIntervalMinMs, maxMs),
                      collectIntervalMaxMs: maxMs
                    });
                  }}
                  className="min-h-[40px] w-16 rounded-md border border-slate-300 px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label="批量采集最大间隔秒数"
                />
                <span className="text-xs text-slate-400">秒</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 数据管理 */}
      <div className="rounded-lg border border-rose-100 bg-white shadow-sm shadow-slate-200/70">
        <div className="border-b border-rose-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">数据管理</h3>
          <p className="mt-0.5 text-xs text-slate-500">清理本地采集缓存，操作不可恢复</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-800">帖子数据</p>
            <button
              onClick={handleClearPosts}
              className="flex min-h-[36px] items-center gap-1 rounded-md px-3 text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4" />
              清空
            </button>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-800">作者数据</p>
            <button
              onClick={handleClearAuthors}
              className="flex min-h-[36px] items-center gap-1 rounded-md px-3 text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4" />
              清空
            </button>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-800">评论数据</p>
            <button
              onClick={handleClearComments}
              className="flex min-h-[36px] items-center gap-1 rounded-md px-3 text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4" />
              清空
            </button>
          </div>

          <div className="border-t border-rose-100 pt-3">
            <button
              onClick={handleClearAll}
              className="min-h-[44px] w-full rounded-md bg-rose-600 text-sm font-medium text-white hover:bg-rose-700"
            >
              清空所有数据
            </button>
          </div>
        </div>
      </div>

      {/* 其他 */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">其他</h3>
        </div>
        <div className="p-4">
          <button
            onClick={handleResetSettings}
            className="flex min-h-[44px] items-center gap-2 rounded-md px-4 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <RotateCcw className="h-4 w-4" />
            重置所有设置
          </button>
        </div>
      </div>
    </div>
  );
}
