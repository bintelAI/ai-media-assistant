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
      const config = await getConfig();
      setCurrentTeamId(config.teamId);
      setCurrentProjectId(config.projectId || '');
      setCurrentProjectName(config.projectName || DEFAULT_PROJECT_NAME);
      syncSheetTargetFromConfig(selectedSheetType, config);
      const result = await checkConnection();
      setConnectionStatus(result.ok ? 'connected' : 'error');
      setStatusMessage(result.message);
      if (result.ok) {
        await loadProjects(config.teamId);
        await loadSheets(config.projectId);
      }
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
    if (!currentProjectId) {
      setFieldStatus('请先选择项目');
      return;
    }

    try {
      setUpdatingSheet(true);
      setFieldStatus('正在创建标准表...');
      const target = await createStandardSheetForType(selectedSheetType, newSheetName);
      setSelectedSheetTarget(target);
      setSelectedSheetId(target.sheetId);
      setNewSheetName('');
      await loadSheets(currentProjectId);
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
      case 'connected': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'checking': return <Database className="w-4 h-4 text-gray-400" />;
      default: return <XCircle className="w-4 h-4 text-gray-400" />;
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
    <div className="h-full overflow-auto p-4 space-y-4">
      {/* 维表智联配置 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-primary-500" />
            <h3 className="font-medium">维表智联 - 数据仓库</h3>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">连接状态</p>
              <p className="text-xs text-gray-400">{statusMessage}</p>
            </div>
            <div className="flex items-center gap-2">
              {connectionIcon()}
              <span className={`text-sm ${connectionStatus === 'connected' ? 'text-green-600' : connectionStatus === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
                {connectionLabel()}
              </span>
              {connectionStatus !== 'checking' && (
                <button
                  onClick={handleRefresh}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                  title="刷新连接"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          {connectionStatus !== 'connected' && (
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={handleOpenWebLogin}
                  disabled={connectionStatus === 'checking'}
                  className="flex-1 py-2 text-sm border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {connectionStatus === 'checking' ? '登录中...' : '登录维表智联'}
                </button>
              </div>
              <p className="text-xs text-gray-400">网页登录成功后，插件会监听维表 Cookie 写入并自动确认登录状态。</p>
            </div>
          )}

          {/* Team / Project config - shown when connected */}
          {connectionStatus === 'connected' && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">团队 ID</label>
                {teamIds.length > 0 ? (
                  <div className="relative">
                    <select
                      value={currentTeamId}
                      onChange={(e) => handleTeamChange(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm appearance-none pr-8 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {teamIds.map((tid) => (
                        <option key={tid} value={tid}>{tid}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={currentTeamId}
                    onChange={(e) => setCurrentTeamId(e.target.value)}
                    onBlur={() => handleTeamChange(currentTeamId)}
                    placeholder="输入团队ID"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">项目</label>
                {loadingProjects ? (
                  <p className="text-xs text-gray-400 py-1.5">加载中...</p>
                ) : projects.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <select
                        value={currentProjectId || currentProjectName}
                        onChange={(e) => handleProjectSelect(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm appearance-none pr-8 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    <button
                      onClick={() => setShowNewProject(!showNewProject)}
                      className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-600"
                    >
                      <Plus className="w-3 h-3" />
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
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="text-xs text-gray-400">未找到项目，可输入名称自动创建</p>
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
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                  />
                  <button
                    onClick={handleCreateProject}
                    disabled={!newProjectName.trim()}
                    className="px-3 py-1.5 bg-primary-500 text-white rounded-md text-sm hover:bg-primary-600 disabled:opacity-50"
                  >
                    创建
                  </button>
                </div>
              )}

              <div className="space-y-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">默认入库表</p>
                    <p className="text-xs text-gray-400">按数据类型分别保存目标表，入库弹窗会复用这里的配置</p>
                  </div>
                  <select
                    value={selectedSheetType}
                    onChange={(e) => handleSheetTypeChange(e.target.value as SheetType)}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="posts">帖子</option>
                    <option value="authors">作者</option>
                    <option value="comments">评论</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{SHEET_TYPE_LABELS[selectedSheetType]}目标表</label>
                  {loadingSheets ? (
                    <p className="text-xs text-gray-400 py-1.5">正在加载表...</p>
                  ) : currentProjectId ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <select
                          value={selectedSheetId}
                          disabled={updatingSheet}
                          onChange={(e) => handleSheetSelect(e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm appearance-none pr-8 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                        >
                          <option value="">请选择已有表</option>
                          {selectedSheetTarget && !sheets.some((sheet) => sheet.sheetId === selectedSheetTarget.sheetId) && (
                            <option value={selectedSheetTarget.sheetId}>{selectedSheetTarget.sheetName}</option>
                          )}
                          {sheets.map((sheet) => (
                            <option key={sheet.sheetId} value={sheet.sheetId}>{sheet.name || sheet.sheetId}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>

                      <input
                        type="text"
                        value={newSheetName}
                        onChange={(e) => setNewSheetName(e.target.value)}
                        placeholder={`新建表名称，默认：${sheetConfig.name}`}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />

                      <div className="flex gap-2">
                        <button
                          onClick={handleCreateStandardSheet}
                          disabled={updatingSheet}
                          className="flex-1 py-1.5 text-sm border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                          创建标准表
                        </button>
                        <button
                          onClick={handleEnsureColumns}
                          disabled={!selectedSheetId || updatingSheet}
                          className="flex-1 py-1.5 text-sm border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                          补齐标准字段
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 py-1.5">请先选择项目后再选择目标表</p>
                  )}
                </div>

                {selectedSheetTarget && (
                  <div className="rounded-md bg-gray-50 border border-gray-100 px-3 py-2">
                    <p className="text-xs text-gray-500">当前默认表</p>
                    <p className="text-sm font-medium text-gray-700">{selectedSheetTarget.sheetName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">主键：{selectedSheetTarget.upsertKeys.join(' + ')}</p>
                  </div>
                )}

                {fieldStatus && (
                  <p className="text-xs text-gray-500">{fieldStatus}</p>
                )}
              </div>
            </div>
          )}

          {connectionStatus === 'connected' && (
            <button
              onClick={handleLogout}
              className="w-full py-2 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50 transition-colors"
            >
              退出维表登录
            </button>
          )}
        </div>
      </div>

      {/* 基础设置 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium">基础设置</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">默认导出格式</p>
              <p className="text-xs text-gray-400">选择导出数据的默认格式</p>
            </div>
            <select
              value={defaultExportFormat}
              onChange={(e) => updateSettings({ defaultExportFormat: e.target.value as 'csv' | 'excel' | 'json' })}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="excel">Excel</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">自动去重</p>
              <p className="text-xs text-gray-400">采集时自动跳过已存在的数据</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoDedupe}
                onChange={(e) => updateSettings({ autoDedupe: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">采集后自动打开侧栏</p>
              <p className="text-xs text-gray-400">采集完成后自动打开 Side Panel</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoOpenSidePanel}
                onChange={(e) => updateSettings({ autoOpenSidePanel: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
            </label>
          </div>
        </div>
      </div>

      {/* 任务设置 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium">任务设置</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">并发数</p>
              <p className="text-xs text-gray-400">同时执行的任务数量</p>
            </div>
            <input
              type="number"
              min={1}
              max={5}
              value={taskConcurrency}
              onChange={(e) => updateSettings({ taskConcurrency: parseInt(e.target.value) })}
              className="w-16 px-2 py-1 border border-gray-300 rounded-md text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">重试次数</p>
              <p className="text-xs text-gray-400">任务失败后的重试次数</p>
            </div>
            <input
              type="number"
              min={0}
              max={5}
              value={retryCount}
              onChange={(e) => updateSettings({ retryCount: parseInt(e.target.value) })}
              className="w-16 px-2 py-1 border border-gray-300 rounded-md text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      {/* 数据管理 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium">数据管理</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm">帖子数据</p>
            <button
              onClick={handleClearPosts}
              className="flex items-center gap-1 px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded"
            >
              <Trash2 className="w-4 h-4" />
              清空
            </button>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm">作者数据</p>
            <button
              onClick={handleClearAuthors}
              className="flex items-center gap-1 px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded"
            >
              <Trash2 className="w-4 h-4" />
              清空
            </button>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm">评论数据</p>
            <button
              onClick={handleClearComments}
              className="flex items-center gap-1 px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded"
            >
              <Trash2 className="w-4 h-4" />
              清空
            </button>
          </div>

          <div className="pt-2 border-t border-gray-200">
            <button
              onClick={handleClearAll}
              className="w-full py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded"
            >
              清空所有数据
            </button>
          </div>
        </div>
      </div>

      {/* 其他 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium">其他</h3>
        </div>
        <div className="p-4">
          <button
            onClick={handleResetSettings}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            <RotateCcw className="w-4 h-4" />
            重置所有设置
          </button>
        </div>
      </div>
    </div>
  );
}
