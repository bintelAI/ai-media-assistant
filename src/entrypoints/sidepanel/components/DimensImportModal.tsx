import { useEffect, useMemo, useState } from 'react';
import { useUIStore, usePostsStore, useAuthorsStore, useCommentsStore } from '@/shared/store';
import { X, Database, Loader2, CheckCircle2, XCircle, AlertCircle, RefreshCw, Settings2, Plus, ChevronDown } from 'lucide-react';
import {
  checkAuth,
  checkConnection,
  clearSheetTarget,
  createNewProject,
  createStandardSheetForType,
  DEFAULT_PROJECT_NAME,
  DEFAULT_TEAM_ID,
  ensureColumns,
  getConfig,
  getProjectInfo,
  getSheetConfig,
  getTeamIds,
  importRows,
  isAuthenticated,
  listColumns,
  listProjects,
  listSheets,
  onDimensAuthChanged,
  openDimensLoginPage,
  saveConfig,
  saveSheetTarget,
  type DimensSheet,
  type DimensSheetTarget,
  type SheetType,
} from '@/shared/services/dimens-service';

export default function DimensImportModal() {
  const { dimensImportTarget, closeDimensImportModal, showToast } = useUIStore();
  const { getExportData: getPostsData } = usePostsStore();
  const { getExportData: getAuthorsData } = useAuthorsStore();
  const { getExportData: getCommentsData } = useCommentsStore();

  const sheetType: SheetType = dimensImportTarget === 'posts' ? 'posts' : dimensImportTarget === 'authors' ? 'authors' : 'comments';
  const sheetConfig = useMemo(() => getSheetConfig(sheetType), [sheetType]);
  const targetLabel = dimensImportTarget === 'posts' ? '帖子' : dimensImportTarget === 'authors' ? '作者' : '评论';

  const [scope, setScope] = useState<'all' | 'filtered' | 'selected'>('selected');
  const [step, setStep] = useState<'checking' | 'credentials' | 'import'>('checking');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ total: 0, completed: 0, success: 0, created: 0, updated: 0, skipped: 0, failed: 0 });
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'preparing' | 'importing' | 'done' | 'error'>('idle');
  const [projectInfo, setProjectInfo] = useState<{ projectId: string; projectName: string } | null>(null);
  const [connStatus, setConnStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [currentTeamId, setCurrentTeamId] = useState(DEFAULT_TEAM_ID);
  const [currentProjectId, setCurrentProjectId] = useState('');
  const [currentProjectName, setCurrentProjectName] = useState(DEFAULT_PROJECT_NAME);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [sheets, setSheets] = useState<DimensSheet[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState('');
  const [selectedSheetTarget, setSelectedSheetTarget] = useState<DimensSheetTarget | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [updatingSheet, setUpdatingSheet] = useState(false);
  const [fieldStatus, setFieldStatus] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newSheetName, setNewSheetName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);

  const loadProjects = async (teamId?: string) => {
    setLoadingProjects(true);
    try {
      setProjects(await listProjects(teamId));
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
      setSheets(await listSheets(projectId));
    } catch {
      setSheets([]);
    } finally {
      setLoadingSheets(false);
    }
  };

  const syncConfigState = async () => {
    const config = await getConfig();
    const target = config.sheetTargets?.[sheetType] || null;
    setCurrentTeamId(config.teamId);
    setCurrentProjectId(config.projectId || '');
    setCurrentProjectName(config.projectName || DEFAULT_PROJECT_NAME);
    setSelectedSheetTarget(target);
    setSelectedSheetId(target?.sheetId || '');
    return config;
  };

  const refreshReadyState = async () => {
    const auth = await checkAuth();
    const tids = await getTeamIds();
    setTeamIds(tids.length > 0 ? tids : auth.teamIds || []);
    const config = await syncConfigState();
    const conn = await checkConnection();
    if (!conn.ok) {
      setConnStatus('disconnected');
      setStep('credentials');
      showToast('登录已确认但连接异常：' + conn.message, 'error');
      return;
    }

    const info = await getProjectInfo();
    setProjectInfo(info);
    setConnStatus('connected');
    setStep('import');
    await loadProjects(config.teamId);
    if (config.projectId) {
      await loadSheets(config.projectId);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await syncConfigState();
        if (await isAuthenticated()) {
          await refreshReadyState();
        } else {
          setConnStatus('disconnected');
          setStep('credentials');
        }
      } catch {
        setConnStatus('disconnected');
        setStep('credentials');
      }
    })();
  }, [sheetType]);

  useEffect(() => {
    return onDimensAuthChanged(async (event) => {
      if (event.status === 'checking') {
        setConnStatus('checking');
        return;
      }

      if (event.status === 'unauthenticated') {
        setConnStatus('disconnected');
        setStep('credentials');
        return;
      }

      try {
        await refreshReadyState();
        showToast('维表智联登录成功', 'success');
      } catch (e: any) {
        setConnStatus('disconnected');
        setStep('credentials');
        showToast('登录状态确认失败：' + (e.message || '未知错误'), 'error');
      }
    });
  }, [sheetType]);

  const handleReconnect = async () => {
    setConnStatus('checking');
    try {
      await refreshReadyState();
      showToast('重新连接成功', 'success');
    } catch (e: any) {
      setConnStatus('disconnected');
      showToast('重新连接失败：' + (e.message || '未知错误'), 'error');
    }
  };

  const handleOpenWebLogin = async () => {
    try {
      setConnStatus('checking');
      await openDimensLoginPage();
      showToast('请在打开的维表智联页面完成登录', 'info');
    } catch (e: any) {
      setConnStatus('disconnected');
      showToast('打开维表登录页失败：' + (e.message || '未知错误'), 'error');
    }
  };

  const handleTeamChange = async (newTeamId: string) => {
    setCurrentTeamId(newTeamId);
    setCurrentProjectId('');
    setCurrentProjectName(DEFAULT_PROJECT_NAME);
    setSelectedSheetId('');
    setSelectedSheetTarget(null);
    setSheets([]);
    setFieldStatus('');
    await saveConfig({ teamId: newTeamId, projectName: DEFAULT_PROJECT_NAME, sheetTargets: {} });
    setProjectInfo(null);
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
    setProjectInfo(null);
    await loadSheets(project.id);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const project = await createNewProject(newProjectName.trim());
      setCurrentProjectId(project.id);
      setCurrentProjectName(project.name);
      await saveConfig({ teamId: currentTeamId, projectId: project.id, projectName: project.name, sheetTargets: {} });
      setNewProjectName('');
      setShowNewProject(false);
      await loadProjects();
      await loadSheets(project.id);
      setProjectInfo(null);
      showToast('项目创建成功', 'success');
    } catch (e: any) {
      showToast('创建项目失败：' + (e.message || '未知错误'), 'error');
    }
  };

  const handleSheetSelect = async (sheetId: string) => {
    if (!sheetId) {
      setSelectedSheetId('');
      setSelectedSheetTarget(null);
      setFieldStatus('');
      await clearSheetTarget(sheetType);
      return;
    }

    const sheet = sheets.find((item) => item.sheetId === sheetId);
    if (!sheet) return;

    setSelectedSheetId(sheet.sheetId);
    setFieldStatus('正在读取字段...');
    setUpdatingSheet(true);
    try {
      const target = await saveSheetTarget(sheetType, sheet);
      setSelectedSheetTarget(target);
      const missingKeys = sheetConfig.primaryKeys.filter((key) => !target.fieldMapping[key]);
      const matchedCount = Object.keys(target.fieldMapping).length;
      setFieldStatus(missingKeys.length > 0
        ? `已匹配 ${matchedCount} 个字段，缺少主键字段：${missingKeys.join('、')}`
        : `已匹配 ${matchedCount} 个字段，可按主键新增或更新`);
    } catch (e: any) {
      setFieldStatus(e.message || '读取字段失败');
      showToast('读取表字段失败：' + (e.message || '未知错误'), 'error');
    } finally {
      setUpdatingSheet(false);
    }
  };

  const handleEnsureColumns = async () => {
    if (!currentProjectId || !selectedSheetId) return;

    try {
      setUpdatingSheet(true);
      setFieldStatus('正在补齐标准字段...');
      const ensured = await ensureColumns(currentTeamId, currentProjectId, selectedSheetId, sheetType);
      const sheet = sheets.find((item) => item.sheetId === selectedSheetId);
      if (sheet) {
        const columns = await listColumns(currentTeamId, currentProjectId, selectedSheetId);
        const target = await saveSheetTarget(sheetType, { ...sheet, columns });
        setSelectedSheetTarget(target);
      }
      if (ensured.missing.length > 0) {
        setFieldStatus(`仍缺少字段：${ensured.missing.join('、')}`);
        showToast('部分字段补齐失败，请检查字段权限', 'error');
      } else {
        setFieldStatus(`字段已补齐，新增字段 ${ensured.created.length} 个`);
        showToast('字段已补齐', 'success');
      }
    } catch (e: any) {
      setFieldStatus(e.message || '补字段失败');
      showToast('补字段失败：' + (e.message || '未知错误'), 'error');
    } finally {
      setUpdatingSheet(false);
    }
  };

  const handleCreateStandardSheet = async () => {
    if (!currentProjectId) {
      showToast('请先选择项目', 'error');
      return;
    }

    try {
      setUpdatingSheet(true);
      setFieldStatus('正在创建标准表...');
      const target = await createStandardSheetForType(sheetType, newSheetName);
      setSelectedSheetTarget(target);
      setSelectedSheetId(target.sheetId);
      setNewSheetName('');
      await loadSheets(currentProjectId);
      setFieldStatus('标准表已创建并补齐字段');
      showToast('标准表创建成功', 'success');
    } catch (e: any) {
      setFieldStatus(e.message || '创建标准表失败');
      showToast('创建标准表失败：' + (e.message || '未知错误'), 'error');
    } finally {
      setUpdatingSheet(false);
    }
  };

  const getData = async () => {
    switch (dimensImportTarget) {
      case 'posts':
        return getPostsData(scope);
      case 'authors':
        return getAuthorsData(scope);
      case 'comments':
        return getCommentsData(scope);
      default:
        return [];
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setStatus('preparing');
    setErrors([]);
    setProgress({ total: 0, completed: 0, success: 0, created: 0, updated: 0, skipped: 0, failed: 0 });

    try {
      if (!(await isAuthenticated())) {
        setConnStatus('disconnected');
        setStep('credentials');
        showToast('请先登录维表智联后再入库', 'error');
        return;
      }

      const data = await getData();
      if (data.length === 0) {
        showToast('没有可导入的数据', 'error');
        setStatus('idle');
        return;
      }
      setProgress(prev => ({ ...prev, total: data.length }));

      setStatus('importing');
      const target = selectedSheetTarget;
      if (!target) {
        setStatus('idle');
        showToast('请先选择维表目标表后再入库', 'error');
        return;
      }
      const { sheetId, fieldMapping } = target;

      const result = await importRows(sheetType, sheetId, fieldMapping, data as Record<string, any>[], (completed, total) => {
        setProgress(prev => ({ ...prev, completed, total }));
      });

      setProgress(prev => ({
        ...prev,
        success: result.success,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
        completed: data.length,
      }));
      setErrors(result.errors.slice(0, 10));

      if (result.failed === 0) {
        setStatus('done');
        showToast(`入库完成：新增 ${result.created} 条，更新 ${result.updated} 条`, 'success');
      } else if (result.success > 0) {
        setStatus('done');
        showToast(`入库完成：新增 ${result.created} 条，更新 ${result.updated} 条，失败 ${result.failed} 条`, 'info');
      } else {
        setStatus('error');
        showToast('入库全部失败，请检查权限或字段映射', 'error');
      }
    } catch (e: any) {
      setStatus('error');
      setErrors([e.message || '入库过程中发生错误']);
      showToast('入库失败：' + (e.message || '未知错误'), 'error');
    } finally {
      setImporting(false);
    }
  };

  if (step === 'checking') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg w-[90%] max-w-lg p-6 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          <span className="text-sm text-gray-600">正在检查连接状态...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[90%] max-w-lg max-h-[90%] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary-500" />
            <h3 className="font-medium">{targetLabel}数据入库 - 维表智联</h3>
          </div>
          <button onClick={closeDimensImportModal} disabled={importing} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {step === 'credentials' ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-700">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">请先登录维表智联</p>
                    <p className="text-xs mt-1">完成网页登录后，插件会通过 Me 接口确认登录状态。</p>
                  </div>
                </div>
              </div>
              <button
                onClick={handleOpenWebLogin}
                disabled={connStatus === 'checking'}
                className="w-full py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
              >
                {connStatus === 'checking' ? '登录中...' : '登录维表智联'}
              </button>
            </>
          ) : (
            <>
              <div className={`rounded-md p-3 text-sm ${
                connStatus === 'connected'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : connStatus === 'checking'
                  ? 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {connStatus === 'connected' ? <CheckCircle2 className="w-4 h-4" /> : connStatus === 'checking' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    <span>{connStatus === 'connected' ? `已连接 (团队: ${currentTeamId})` : connStatus === 'checking' ? '正在检查连接...' : '连接已断开'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {connStatus !== 'checking' && (
                      <button onClick={handleReconnect} className="p-1 hover:bg-white/50 rounded" title="重新连接">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => setShowConfig(!showConfig)} className={`p-1 hover:bg-white/50 rounded ${showConfig ? 'bg-white/30' : ''}`} title="切换团队/项目">
                      <Settings2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {projectInfo && connStatus === 'connected' && <p className="text-xs mt-1 ml-6">项目: {projectInfo.projectName}</p>}
              </div>

              {showConfig && (
                <div className="border border-gray-200 rounded-md p-3 space-y-3 bg-gray-50">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">团队 ID</label>
                    {teamIds.length > 0 ? (
                      <div className="relative">
                        <select value={currentTeamId} onChange={(e) => handleTeamChange(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm appearance-none pr-8 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                          {teamIds.map((tid) => <option key={tid} value={tid}>{tid}</option>)}
                        </select>
                        <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    ) : (
                      <input type="text" value={currentTeamId} onChange={(e) => setCurrentTeamId(e.target.value)} onBlur={() => handleTeamChange(currentTeamId)} placeholder="输入团队ID" className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">项目</label>
                    {loadingProjects ? (
                      <div className="flex items-center gap-2 text-xs text-gray-500 py-1.5"><Loader2 className="w-3 h-3 animate-spin" />加载项目列表...</div>
                    ) : projects.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="relative">
                          <select value={currentProjectId} onChange={(e) => handleProjectSelect(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm appearance-none pr-8 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                            <option value="">请选择项目</option>
                            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                        <button onClick={() => setShowNewProject(!showNewProject)} className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-600">
                          <Plus className="w-3 h-3" />{showNewProject ? '取消创建' : '创建新项目'}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">未找到项目，可创建新项目。</p>
                    )}
                  </div>

                  {showNewProject && (
                    <div className="flex gap-2">
                      <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="新项目名称" className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()} />
                      <button onClick={handleCreateProject} disabled={!newProjectName.trim()} className="px-3 py-1.5 bg-primary-500 text-white rounded-md text-sm hover:bg-primary-600 disabled:opacity-50">创建</button>
                    </div>
                  )}
                </div>
              )}

              {connStatus === 'connected' && (
                <div className="border border-gray-200 rounded-md p-3 space-y-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-gray-600">目标表</label>
                    <button type="button" onClick={handleCreateStandardSheet} disabled={!currentProjectId || loadingSheets || updatingSheet} className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-600 disabled:opacity-50">
                      <Plus className="w-3 h-3" />创建标准表
                    </button>
                  </div>
                  {loadingSheets ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 py-1.5"><Loader2 className="w-3 h-3 animate-spin" />加载表列表...</div>
                  ) : sheets.length > 0 ? (
                    <div className="relative">
                      <select value={selectedSheetId} disabled={updatingSheet} onChange={(e) => handleSheetSelect(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm appearance-none pr-8 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50">
                        <option value="">请选择表</option>
                        {selectedSheetTarget && !sheets.some((sheet) => sheet.sheetId === selectedSheetTarget.sheetId) && (
                          <option value={selectedSheetTarget.sheetId}>{selectedSheetTarget.sheetName}</option>
                        )}
                        {sheets.map((sheet) => <option key={sheet.sheetId} value={sheet.sheetId}>{sheet.name}</option>)}
                      </select>
                      <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">当前项目下暂无可选表，可创建标准表。</p>
                  )}
                  <input
                    type="text"
                    value={newSheetName}
                    onChange={(e) => setNewSheetName(e.target.value)}
                    placeholder={`新建表名称，默认：${sheetConfig.name}`}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {selectedSheetId && <button onClick={handleEnsureColumns} disabled={updatingSheet} className="text-xs text-primary-500 hover:text-primary-600 disabled:opacity-50">补齐标准字段</button>}
                  {fieldStatus && <p className="text-xs text-gray-500">{fieldStatus}</p>}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">导入范围</label>
                <div className="flex gap-2">
                  {[
                    { value: 'all', label: '全部数据' },
                    { value: 'filtered', label: '筛选结果' },
                    { value: 'selected', label: '选中数据' },
                  ].map((opt) => (
                    <button key={opt.value} onClick={() => setScope(opt.value as any)} className={`px-3 py-1.5 text-sm rounded-md ${scope === opt.value ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{opt.label}</button>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm text-gray-600">
                <div className="flex items-center gap-2 mb-1">
                  <Database className="w-4 h-4" />
                  <span className="font-medium">目标表格</span>
                </div>
                <p className="text-xs mt-1">
                  数据将按主键新增或更新到 <strong>{selectedSheetTarget?.sheetName || sheetConfig.name}</strong>
                  {status === 'idle' && (selectedSheetTarget ? '' : '（未选择表时将使用或创建默认标准表）')}
                </p>
              </div>

              {status !== 'idle' && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">
                    {status === 'preparing' && '正在准备数据表结构...'}
                    {status === 'importing' && `正在入库数据 (${progress.completed}/${progress.total})...`}
                    {status === 'done' && '入库完成'}
                    {status === 'error' && '入库出错'}
                  </div>
                  {status === 'importing' && progress.total > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-primary-500 h-2 rounded-full transition-all duration-300" style={{ width: `${(progress.completed / progress.total) * 100}%` }} />
                    </div>
                  )}
                  {(progress.success > 0 || progress.failed > 0) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-4 h-4" />新增: {progress.created}</span>
                      <span className="flex items-center gap-1 text-blue-600">更新: {progress.updated}</span>
                      <span className="flex items-center gap-1 text-gray-500">跳过: {progress.skipped}</span>
                      {progress.failed > 0 && <span className="flex items-center gap-1 text-red-600"><XCircle className="w-4 h-4" />失败: {progress.failed}</span>}
                    </div>
                  )}
                  {errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-2 max-h-24 overflow-auto">
                      {errors.map((err, i) => <p key={i} className="text-xs text-red-600 truncate">{err}</p>)}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {status === 'done' ? (
                  <button onClick={closeDimensImportModal} className="flex-1 py-2 bg-primary-500 text-white rounded-md text-sm hover:bg-primary-600">完成</button>
                ) : status === 'error' ? (
                  <button onClick={handleImport} disabled={importing} className="flex-1 py-2 bg-orange-500 text-white rounded-md text-sm hover:bg-orange-600 disabled:opacity-50">重试</button>
                ) : (
                  <button onClick={handleImport} disabled={importing || connStatus !== 'connected'} className="flex-1 py-2 bg-primary-500 text-white rounded-md text-sm hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2">
                    {importing ? <><Loader2 className="w-4 h-4 animate-spin" />入库中...</> : <><Database className="w-4 h-4" />开始入库</>}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
