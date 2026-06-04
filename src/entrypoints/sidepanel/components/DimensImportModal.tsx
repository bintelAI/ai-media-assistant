import { useEffect, useMemo, useState } from 'react';
import { useUIStore, usePostsStore, useAuthorsStore, useCommentsStore } from '@/shared/store';
import { ArrowLeft, Database, Loader2, CheckCircle2, XCircle, AlertCircle, RefreshCw, Settings2, Plus, ChevronDown } from 'lucide-react';
import {
  checkAuth,
  checkConnection,
  clearSheetTarget,
  createNewProject,
  createStandardSheetForType,
  DEFAULT_PROJECT_NAME,
  DEFAULT_TEAM_ID,
  ensureSheetTarget,
  getConfig,
  getDimensLoadErrorMessage,
  getProjectInfo,
  getSheetConfig,
  getSheetViewUrl,
  getTeamIds,
  importRows,
  isAuthenticated,
  listProjects,
  listSheets,
  onDimensAuthChanged,
  openDimensAuthorizedPage,
  openDimensLoginPage,
  repairSheetStructure,
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

  useEffect(() => {
    if (!dimensImportTarget) {
      closeDimensImportModal();
    }
  }, [dimensImportTarget]);

  const sheetType: SheetType = dimensImportTarget === 'posts' ? 'posts' : dimensImportTarget === 'authors' ? 'authors' : 'comments';
  const sheetConfig = useMemo(() => getSheetConfig(sheetType), [sheetType]);
  const targetLabel = dimensImportTarget === 'posts' ? '帖子' : dimensImportTarget === 'authors' ? '作者' : '评论';

  const [scope, setScope] = useState<'all' | 'filtered' | 'selected'>('all');
  const [step, setStep] = useState<'checking' | 'credentials' | 'import'>('checking');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ total: 0, completed: 0, success: 0, created: 0, updated: 0, skipped: 0, failed: 0, deduped: 0, dirtySkipped: 0 });
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
  const [projectLoadError, setProjectLoadError] = useState('');
  const [sheetLoadError, setSheetLoadError] = useState('');
  const [updatingSheet, setUpdatingSheet] = useState(false);
  const [fieldStatus, setFieldStatus] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newSheetName, setNewSheetName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const connectionCardClass =
    connStatus === 'connected'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : connStatus === 'checking'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-rose-200 bg-rose-50 text-rose-800';

  const loadProjects = async (teamId?: string) => {
    setLoadingProjects(true);
    setProjectLoadError('');
    try {
      setProjects(await listProjects(teamId));
    } catch (e) {
      setProjects([]);
      setProjectLoadError(getDimensLoadErrorMessage(e, 'project'));
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadSheets = async (projectId?: string) => {
    if (!projectId) {
      setSheets([]);
      setSheetLoadError('');
      return;
    }

    setLoadingSheets(true);
    setSheetLoadError('');
    try {
      setSheets(await listSheets(projectId));
    } catch (e) {
      setSheets([]);
      setSheetLoadError(getDimensLoadErrorMessage(e, 'sheet'));
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
    const conn = await checkConnection();
    if (!conn.ok) {
      setConnStatus('disconnected');
      setStep('credentials');
      showToast('登录已确认但连接异常：' + conn.message, 'error');
      return;
    }

    const info = await getProjectInfo();
    setProjectInfo(info);
    const config = await syncConfigState();
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
    setSheetLoadError('');
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
    setSheetLoadError('');
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
      const sheet = sheets.find((item) => item.sheetId === selectedSheetId);
      const ensured = await repairSheetStructure(currentTeamId, currentProjectId, selectedSheetId, sheetType, sheet?.name);
      if (sheet) {
        const target = await saveSheetTarget(sheetType, sheet);
        setSelectedSheetTarget(target);
      }
      if (ensured.missing.length > 0) {
        setFieldStatus(`仍缺少字段：${ensured.missing.join('、')}`);
        showToast('部分字段补齐失败，请检查字段权限', 'error');
      } else if (ensured.health.status === 'risk') {
        setFieldStatus(`字段已补齐，但存在类型不一致：${ensured.health.warnings.slice(0, 2).join('；')}`);
        showToast('字段已补齐，但旧表存在字段类型风险', 'info');
      } else {
        setFieldStatus(`字段与默认视图已补齐，新增/修复 ${ensured.created.length} 项`);
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
    try {
      setUpdatingSheet(true);
      setFieldStatus('正在创建标准表...');
      const target = await createStandardSheetForType(sheetType, newSheetName);
      setSelectedSheetTarget(target);
      setSelectedSheetId(target.sheetId);
      setNewSheetName('');
      const config = await syncConfigState();
      await loadProjects(config.teamId);
      await loadSheets(config.projectId);
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
    let data: any[] = [];
    switch (dimensImportTarget) {
      case 'posts':
        data = await getPostsData(scope);
        break;
      case 'authors':
        data = await getAuthorsData(scope);
        break;
      case 'comments':
        data = await getCommentsData(scope);
        break;
      default:
        return [];
    }

    if (scope === 'selected' && data.length === 0) {
      showToast('未选中数据，已自动改为导入全部数据', 'info');
      setScope('all');
      switch (dimensImportTarget) {
        case 'posts':
          return getPostsData('all');
        case 'authors':
          return getAuthorsData('all');
        case 'comments':
          return getCommentsData('all');
        default:
          return [];
      }
    }

    return data;
  };

  const handleImport = async () => {
    setImporting(true);
    setStatus('preparing');
    setErrors([]);
    setProgress({ total: 0, completed: 0, success: 0, created: 0, updated: 0, skipped: 0, failed: 0, deduped: 0, dirtySkipped: 0 });

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

      let target = selectedSheetTarget;
      if (!target) {
        setFieldStatus('正在使用或创建默认标准表...');
        target = await ensureSheetTarget(sheetType);
        setSelectedSheetTarget(target);
        setSelectedSheetId(target.sheetId);
        const config = await syncConfigState();
        await loadProjects(config.teamId);
        await loadSheets(config.projectId);
      } else {
        const repaired = await repairSheetStructure(
          target.teamId || currentTeamId,
          target.projectId || currentProjectId,
          target.sheetId,
          sheetType,
          target.sheetName
        );
        target = {
          ...target,
          fieldMapping: repaired.fieldMapping,
          fieldBindings: repaired.fieldBindings,
          healthStatus: repaired.health.status,
          healthWarnings: repaired.health.warnings,
          checkedAt: Date.now(),
        };
        setSelectedSheetTarget(target);
      }
      const { sheetId, fieldMapping } = target;

      setStatus('importing');
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
        deduped: result.deduped,
        dirtySkipped: result.dirtySkipped,
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

  const handleOpenSheet = async () => {
    const sheetId = selectedSheetTarget?.sheetId;
    if (!sheetId) {
      showToast('未找到目标表，请先确认入库表配置', 'error');
      return;
    }

    try {
      const url = await getSheetViewUrl(sheetId, selectedSheetTarget);
      await openDimensAuthorizedPage(url);
    } catch (e: any) {
      showToast('打开维表失败：' + (e.message || '未知错误'), 'error');
    }
  };

  if (step === 'checking') {
    return (
      <div className="flex h-full flex-col bg-slate-50">
        <div className="flex h-12 items-center gap-2 border-b border-slate-200 bg-white px-3">
          <button
            type="button"
            onClick={closeDimensImportModal}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="返回数据页"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-950">{targetLabel}数据入库</h3>
            <p className="text-[11px] text-slate-500">正在检查维表连接</p>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="flex w-full max-w-sm items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white p-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
            <span className="text-sm text-slate-600">正在检查连接状态...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
        <div className="border-b border-slate-200 bg-white px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={closeDimensImportModal}
                disabled={importing}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                aria-label="返回数据页"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-slate-950">{targetLabel}数据入库</h3>
                <p className="mt-0.5 text-xs text-slate-500">写入维表智联，自动补齐项目与标准表</p>
              </div>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-600">
              <Database className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-auto bg-slate-50 p-4">
          {step === 'credentials' ? (
            <>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="font-medium">请先登录维表智联</p>
                    <p className="mt-1 text-xs text-blue-700">完成网页登录后，插件会通过 Me 接口确认登录状态。</p>
                  </div>
                </div>
              </div>
              <button
                onClick={handleOpenWebLogin}
                disabled={connStatus === 'checking'}
                className="flex min-h-[44px] w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                {connStatus === 'checking' ? '登录中...' : '登录维表智联'}
              </button>
            </>
          ) : (
            <>
              <div className={`rounded-lg border p-3 text-sm ${connectionCardClass}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {connStatus === 'connected' ? <CheckCircle2 className="h-4 w-4" /> : connStatus === 'checking' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    <span className="font-medium">{connStatus === 'connected' ? `已连接 · ${currentTeamId}` : connStatus === 'checking' ? '正在检查连接...' : '连接已断开'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {connStatus !== 'checking' && (
                      <button onClick={handleReconnect} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/60" title="重新连接" aria-label="重新连接">
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => setShowConfig(!showConfig)} className={`flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/60 ${showConfig ? 'bg-white/50' : ''}`} title="切换团队/项目" aria-label="切换团队或项目">
                      <Settings2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {projectInfo && connStatus === 'connected' && <p className="ml-6 mt-1 text-xs opacity-80">项目: {projectInfo.projectName}</p>}
              </div>

              {showConfig && (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/60">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">团队 ID</label>
                    {teamIds.length > 0 ? (
                      <div className="relative">
                        <select value={currentTeamId} onChange={(e) => handleTeamChange(e.target.value)} className="min-h-[40px] w-full appearance-none rounded-md border border-slate-300 bg-white px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                          {teamIds.map((tid) => <option key={tid} value={tid}>{tid}</option>)}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      </div>
                    ) : (
                      <input type="text" value={currentTeamId} onChange={(e) => setCurrentTeamId(e.target.value)} onBlur={() => handleTeamChange(currentTeamId)} placeholder="输入团队ID" className="min-h-[40px] w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">项目</label>
                    {loadingProjects ? (
                      <div className="flex items-center gap-2 py-1.5 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" />加载项目列表...</div>
                    ) : projectLoadError ? (
                      <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                        <p className="leading-5">{projectLoadError}</p>
                        <button
                          type="button"
                          onClick={() => loadProjects(currentTeamId)}
                          className="mt-1 inline-flex min-h-[30px] items-center gap-1 font-medium text-rose-700 hover:text-rose-800"
                        >
                          <RefreshCw className="h-3 w-3" />重新加载项目
                        </button>
                      </div>
                    ) : projects.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="relative">
                          <select value={currentProjectId} onChange={(e) => handleProjectSelect(e.target.value)} className="min-h-[40px] w-full appearance-none rounded-md border border-slate-300 bg-white px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                            <option value="">请选择项目</option>
                            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        </div>
                        <button onClick={() => setShowNewProject(!showNewProject)} className="flex min-h-[32px] items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700">
                          <Plus className="h-3 w-3" />{showNewProject ? '取消创建' : '创建新项目'}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">未找到项目，可创建新项目。</p>
                    )}
                  </div>

                  {showNewProject && (
                    <div className="flex gap-2">
                      <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="新项目名称" className="min-h-[40px] flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()} />
                      <button onClick={handleCreateProject} disabled={!newProjectName.trim()} className="min-h-[40px] rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">创建</button>
                    </div>
                  )}
                </div>
              )}

              {connStatus === 'connected' && (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/60">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-slate-600">目标表</label>
                    <button type="button" onClick={handleCreateStandardSheet} disabled={loadingSheets || updatingSheet} className="flex min-h-[32px] items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50">
                      <Plus className="h-3 w-3" />创建标准表
                    </button>
                  </div>
                  {loadingSheets ? (
                    <div className="flex items-center gap-2 py-1.5 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" />加载表列表...</div>
                  ) : sheetLoadError ? (
                    <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                      <p className="leading-5">{sheetLoadError}</p>
                      <button
                        type="button"
                        onClick={() => loadSheets(currentProjectId)}
                        className="mt-1 inline-flex min-h-[30px] items-center gap-1 font-medium text-rose-700 hover:text-rose-800"
                      >
                        <RefreshCw className="h-3 w-3" />重新加载表
                      </button>
                    </div>
                  ) : sheets.length > 0 ? (
                    <div className="relative">
                      <select value={selectedSheetId} disabled={updatingSheet} onChange={(e) => handleSheetSelect(e.target.value)} className="min-h-[40px] w-full appearance-none rounded-md border border-slate-300 bg-white px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50">
                        <option value="">请选择表</option>
                        {selectedSheetTarget && !sheets.some((sheet) => sheet.sheetId === selectedSheetTarget.sheetId) && (
                          <option value={selectedSheetTarget.sheetId}>{selectedSheetTarget.sheetName}</option>
                        )}
                        {sheets.map((sheet) => <option key={sheet.sheetId} value={sheet.sheetId}>{sheet.name}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">当前项目下暂无可选表，可创建标准表。</p>
                  )}
                  <input
                    type="text"
                    value={newSheetName}
                    onChange={(e) => setNewSheetName(e.target.value)}
                    placeholder={`新建表名称，默认：${sheetConfig.name}`}
                    className="min-h-[40px] w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {selectedSheetId && <button onClick={handleEnsureColumns} disabled={updatingSheet} className="min-h-[32px] text-xs font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50">补齐标准字段</button>}
                  {fieldStatus && <p className="text-xs text-slate-500">{fieldStatus}</p>}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">导入范围</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'all', label: '全部数据' },
                    { value: 'filtered', label: '筛选结果' },
                    { value: 'selected', label: '选中数据' },
                  ].map((opt) => (
                    <button key={opt.value} onClick={() => setScope(opt.value as any)} className={`min-h-[40px] rounded-md px-2 text-sm font-medium transition-colors ${scope === opt.value ? 'bg-slate-950 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'}`}>{opt.label}</button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-sm shadow-slate-200/60">
                <div className="flex items-center gap-2 mb-1">
                  <Database className="h-4 w-4 text-primary-600" />
                  <span className="font-semibold text-slate-900">目标表格</span>
                </div>
                <p className="text-xs mt-1">
                  数据将按主键新增或更新到 <strong>{selectedSheetTarget?.sheetName || sheetConfig.name}</strong>
                  {status === 'idle' && (selectedSheetTarget ? '' : '（未选择表时将使用或创建默认标准表）')}
                </p>
              </div>

              {status !== 'idle' && (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/60">
                  <div className="text-sm font-semibold text-slate-900">
                    {status === 'preparing' && '正在准备数据表结构...'}
                    {status === 'importing' && `正在入库数据 (${progress.completed}/${progress.total})...`}
                    {status === 'done' && '入库完成'}
                    {status === 'error' && '入库出错'}
                  </div>
                  {status === 'importing' && progress.total > 0 && (
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-cyan-500 transition-all duration-300" style={{ width: `${(progress.completed / progress.total) * 100}%` }} />
                    </div>
                  )}
                  {(progress.success > 0 || progress.failed > 0) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-4 h-4" />新增: {progress.created}</span>
                      <span className="flex items-center gap-1 text-blue-600">更新: {progress.updated}</span>
                      <span className="flex items-center gap-1 text-slate-500">跳过: {progress.skipped}</span>
                      {progress.deduped > 0 && <span className="flex items-center gap-1 text-slate-500">重复: {progress.deduped}</span>}
                      {progress.dirtySkipped > 0 && <span className="flex items-center gap-1 text-amber-600">无效: {progress.dirtySkipped}</span>}
                      {progress.failed > 0 && <span className="flex items-center gap-1 text-red-600"><XCircle className="w-4 h-4" />失败: {progress.failed}</span>}
                    </div>
                  )}
                  {errors.length > 0 && (
                    <div className="max-h-24 overflow-auto rounded-md border border-red-200 bg-red-50 p-2">
                      {errors.map((err, i) => <p key={i} className="text-xs text-red-600 truncate">{err}</p>)}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {status === 'done' ? (
                  <>
                    <button onClick={handleOpenSheet} className="min-h-[44px] flex-1 rounded-md bg-slate-950 px-3 text-sm font-medium text-white hover:bg-slate-800">跳转维表查看</button>
                    <button onClick={closeDimensImportModal} className="min-h-[44px] flex-1 rounded-md bg-primary-600 px-3 text-sm font-medium text-white hover:bg-primary-700">完成</button>
                  </>
                ) : status === 'error' ? (
                  <button onClick={handleImport} disabled={importing} className="min-h-[44px] flex-1 rounded-md bg-orange-500 px-3 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">重试</button>
                ) : (
                  <button onClick={handleImport} disabled={importing || connStatus !== 'connected'} className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md bg-primary-600 px-3 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                    {importing ? <><Loader2 className="h-4 w-4 animate-spin" />入库中...</> : <><Database className="h-4 w-4" />开始入库</>}
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
