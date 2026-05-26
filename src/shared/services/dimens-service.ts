import { sendMessage } from '../utils/messaging';
import type { Message, DimensAuthChangedMessage } from '../types/messages';
import { ChromeStorage } from '../utils/storage';

const DIMENS_BASE = 'https://dimens.bintelai.com/api';
const STORAGE_KEY_AUTH = 'dimens_auth';
const STORAGE_KEY_CONFIG = 'dimens_config';
const DEFAULT_TEAM_ID = 'TTFFEN';
const DEFAULT_PROJECT_NAME = '智联AI数据仓库';
const DIMENS_AUTH_REQUIRED = 'DIMENS_AUTH_REQUIRED';

export interface DimensAuth {
  teamIds?: string[];
  source: 'dimens-cookie';
  checkedAt: number;
  userInfo?: any;
  cookieName?: string;
}

export type DimensAuthChanged = DimensAuthChangedMessage;

export type SheetType = 'posts' | 'authors' | 'comments';

export interface DimensConfig {
  teamId: string;
  projectId?: string;
  projectName?: string;
  sheetTargets?: Partial<Record<SheetType, DimensSheetTarget>>;
}

export interface DimensSheetTarget {
  sheetId: string;
  sheetName: string;
  fieldMapping: Record<string, string>;
  upsertKeys: string[];
  checkedAt: number;
}

export interface DimensProject {
  id: string;
  name: string;
}

export interface DimensSheet {
  sheetId: string;
  name: string;
  type: string;
  columns?: DimensColumn[];
}

export interface DimensColumn {
  fieldId: string;
  label: string;
  type: string;
}

interface DimensRow {
  rowId: string;
  data: Record<string, any>;
  version?: number | string;
}

export interface DimensImportResult {
  success: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

interface SheetConfig {
  name: string;
  primaryKeys: string[];
  columns: { label: string; type: string; key: string }[];
}

const SHEET_CONFIGS: Record<SheetType, SheetConfig> = {
  posts: {
    name: '帖子数据',
    primaryKeys: ['platform', 'postId'],
    columns: [
      { label: '平台', type: 'text', key: 'platform' },
      { label: '帖子ID', type: 'text', key: 'postId' },
      { label: '内容类型', type: 'text', key: 'postType' },
      { label: '标题', type: 'text', key: 'title' },
      { label: '内容描述', type: 'text', key: 'content' },
      { label: '帖子链接', type: 'text', key: 'url' },
      { label: '封面图', type: 'text', key: 'coverUrl' },
      { label: '发布时间', type: 'text', key: 'publishTime' },
      { label: '作者ID', type: 'text', key: 'authorId' },
      { label: '作者昵称', type: 'text', key: 'authorName' },
      { label: '作者主页链接', type: 'text', key: 'authorUrl' },
      { label: '点赞数', type: 'text', key: 'likeCount' },
      { label: '评论数', type: 'text', key: 'commentCount' },
      { label: '收藏数', type: 'text', key: 'collectCount' },
      { label: '分享数', type: 'text', key: 'shareCount' },
      { label: '播放数', type: 'text', key: 'viewCount' },
      { label: '媒体数量', type: 'text', key: 'mediaCount' },
      { label: '标签', type: 'text', key: 'tags' },
      { label: '来源页面', type: 'text', key: 'sourcePageUrl' },
      { label: '采集时间', type: 'text', key: 'collectedAt' },
      { label: '更新时间', type: 'text', key: 'updatedAt' },
      { label: '备注', type: 'text', key: 'note' },
    ],
  },
  authors: {
    name: '作者数据',
    primaryKeys: ['platform', 'authorId'],
    columns: [
      { label: '平台', type: 'text', key: 'platform' },
      { label: '作者ID', type: 'text', key: 'authorId' },
      { label: '昵称', type: 'text', key: 'name' },
      { label: '头像', type: 'text', key: 'avatar' },
      { label: '主页链接', type: 'text', key: 'profileUrl' },
      { label: '简介', type: 'text', key: 'bio' },
      { label: '粉丝数', type: 'text', key: 'fansCount' },
      { label: '关注数', type: 'text', key: 'followCount' },
      { label: '获赞数', type: 'text', key: 'likedCount' },
      { label: '作品数', type: 'text', key: 'workCount' },
      { label: '地区', type: 'text', key: 'location' },
      { label: '性别', type: 'text', key: 'gender' },
      { label: '是否认证', type: 'text', key: 'verified' },
      { label: '认证说明', type: 'text', key: 'verifiedDesc' },
      { label: '联系方式', type: 'text', key: 'contactInfo' },
      { label: '来源页面', type: 'text', key: 'sourcePageUrl' },
      { label: '采集时间', type: 'text', key: 'collectedAt' },
      { label: '更新时间', type: 'text', key: 'updatedAt' },
      { label: '备注', type: 'text', key: 'note' },
    ],
  },
  comments: {
    name: '评论数据',
    primaryKeys: ['platform', 'commentId'],
    columns: [
      { label: '平台', type: 'text', key: 'platform' },
      { label: '评论ID', type: 'text', key: 'commentId' },
      { label: '所属帖子ID', type: 'text', key: 'postId' },
      { label: '所属帖子标题', type: 'text', key: 'postTitle' },
      { label: '评论用户ID', type: 'text', key: 'authorId' },
      { label: '评论用户昵称', type: 'text', key: 'authorName' },
      { label: '评论内容', type: 'text', key: 'content' },
      { label: '点赞数', type: 'text', key: 'likeCount' },
      { label: '回复数', type: 'text', key: 'replyCount' },
      { label: '发布时间', type: 'text', key: 'publishTime' },
      { label: '来源页面', type: 'text', key: 'sourcePageUrl' },
      { label: '采集时间', type: 'text', key: 'collectedAt' },
    ],
  },
};

async function proxyRequest(
  method: string,
  path: string,
  body?: unknown,
  useAuth: boolean = true
): Promise<any> {
  const response = await sendMessage<any, any>('dimens:proxy', {
    method,
    path,
    body,
    useAuth,
  });
  if (!response.success) {
    const error = new Error(response.error || 'Dimens请求失败') as Error & { code?: string };
    error.code = response.code;
    throw error;
  }
  return response.data;
}

async function getAuth(): Promise<DimensAuth | null> {
  return ChromeStorage.getItem<DimensAuth>(STORAGE_KEY_AUTH);
}

function normalizeConfig(config?: Partial<DimensConfig> | null): DimensConfig {
  return {
    teamId: config?.teamId || DEFAULT_TEAM_ID,
    projectId: config?.projectId,
    projectName: config?.projectName || DEFAULT_PROJECT_NAME,
    sheetTargets: config?.sheetTargets || {},
  };
}

export async function getConfig(): Promise<DimensConfig> {
  const config = await ChromeStorage.getItem<DimensConfig>(STORAGE_KEY_CONFIG);
  return normalizeConfig(config);
}

export async function saveConfig(config: DimensConfig): Promise<void> {
  await ChromeStorage.setItem(STORAGE_KEY_CONFIG, normalizeConfig(config));
}

async function ensureConfigTeamMatchesAuth(auth: DimensAuth): Promise<void> {
  const teamIds = auth.teamIds || [];
  if (teamIds.length === 0) return;

  const config = await getConfig();
  if (teamIds.includes(config.teamId)) return;

  await saveConfig({
    teamId: teamIds[0],
    projectName: DEFAULT_PROJECT_NAME,
    sheetTargets: {},
  });
}

export async function checkAuth(): Promise<DimensAuth> {
  const response = await sendMessage<undefined, DimensAuth>('dimens:me');
  if (!response.success || !response.data) {
    const error = new Error(response.error || '请先登录维表智联') as Error & { code?: string };
    error.code = response.code || DIMENS_AUTH_REQUIRED;
    throw error;
  }
  await ensureConfigTeamMatchesAuth(response.data);
  return response.data;
}

export const captureDimensCookieToken = checkAuth;

export async function openDimensLoginPage(): Promise<void> {
  const response = await sendMessage('dimens:open-login-page');
  if (!response.success) {
    throw new Error(response.error || '打开维表登录页失败');
  }
}

export async function logout(): Promise<void> {
  const response = await sendMessage('dimens:logout');
  if (!response.success) {
    throw new Error(response.error || '退出维表登录失败');
  }
}

export function onDimensAuthChanged(handler: (data: DimensAuthChanged) => void): () => void {
  const listener = (message: Message<DimensAuthChanged>) => {
    if (message.type !== 'dimens:auth-changed' || !message.data) return;
    handler(message.data);
  };

  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    await checkAuth();
    return true;
  } catch {
    return false;
  }
}

export async function getTeamIds(): Promise<string[]> {
  const auth = await getAuth();
  return auth?.teamIds || [];
}

export function getSheetConfig(sheetType: SheetType): SheetConfig {
  return SHEET_CONFIGS[sheetType];
}

export function getSheetTypePrimaryKeys(sheetType: SheetType): string[] {
  return SHEET_CONFIGS[sheetType].primaryKeys;
}

export async function listProjects(teamId?: string): Promise<DimensProject[]> {
  const config = await getConfig();
  const tid = teamId || config.teamId;
  const result = await proxyRequest('POST', `/app/org/${tid}/project/page`, {
    page: 1,
    size: 50,
  });
  const list = result.data?.list || result.data || [];
  return (Array.isArray(list) ? list : []).map((p: any) => ({
    id: p.id,
    name: p.name,
  }));
}

async function findProject(teamId?: string, projectName?: string): Promise<DimensProject | null> {
  const config = await getConfig();
  const tid = teamId || config.teamId;
  const pname = projectName || config.projectName;
  const projects = await listProjects(tid);
  return projects.find((p) => p.name === pname) || null;
}

async function getConfiguredProjectId(): Promise<string> {
  const config = await getConfig();
  if (config.projectId) return config.projectId;

  const project = await findProject(config.teamId, config.projectName);
  if (!project) {
    throw new Error('请先选择维表项目');
  }

  await saveConfig({
    ...config,
    projectId: project.id,
    projectName: project.name,
  });
  return project.id;
}

async function createProject(teamId?: string, projectName?: string): Promise<DimensProject> {
  const config = await getConfig();
  const tid = teamId || config.teamId;
  const pname = projectName || config.projectName || DEFAULT_PROJECT_NAME;
  const result = await proxyRequest('POST', `/app/org/${tid}/project/add`, {
    name: pname,
    description: '智联AI采集助手自动创建的社交媒体数据仓库',
    projectType: 'spreadsheet',
  });
  const data = result.data || result;
  return { id: data.id, name: data.name || pname };
}

async function ensureProject(): Promise<string> {
  const config = await getConfig();
  if (config.projectId) return config.projectId;

  let project = await findProject(config.teamId, config.projectName);
  if (!project) {
    project = await createProject(config.teamId, config.projectName);
  }

  await saveConfig({
    ...config,
    projectId: project.id,
    projectName: project.name,
  });
  return project.id;
}

export async function listSheets(projectId: string): Promise<DimensSheet[]> {
  const result = await proxyRequest('GET', `/app/mul/project/${projectId}/sheet/list`);
  const list = result.data || result || [];
  return (Array.isArray(list) ? list : [])
    .filter((s: any) => s.type === 'sheet' || !s.type)
    .map((s: any) => ({
      sheetId: s.sheetId || s.id,
      name: s.name || '',
      type: s.type || 'sheet',
      columns: s.config?.columns
        ?.filter((c: any) => !(c.fieldId || c.id || '').startsWith('__system'))
        .map((c: any) => ({ fieldId: c.fieldId || c.id, label: c.label || c.title || '', type: c.type || 'text' })) || [],
    }));
}

async function createSheet(projectId: string, name: string): Promise<string> {
  const result = await proxyRequest('POST', `/app/mul/project/${projectId}/sheet/create`, { name });
  const data = result.data || result;
  return data.id || data.sheetId;
}

async function createColumn(
  teamId: string,
  projectId: string,
  sheetId: string,
  label: string,
  type: string
): Promise<string> {
  const result = await proxyRequest(
    'POST',
    `/app/mul/${teamId}/${projectId}/sheet/${sheetId}/column/create`,
    { label, type }
  );
  const data = result.data || result;
  return data.id || data.fieldId;
}

export async function listColumns(teamId: string, projectId: string, sheetId: string): Promise<DimensColumn[]> {
  const result = await proxyRequest(
    'GET',
    `/app/mul/${teamId}/${projectId}/sheet/${sheetId}/column/list`
  );
  return (result.data || result || [])
    .filter((c: any) => !(c.id || c.fieldId || '').startsWith('__system'))
    .map((c: any) => ({
      fieldId: c.id || c.fieldId,
      label: c.label || c.title || '',
      type: c.type || 'text',
    }));
}

function buildFieldMapping(columns: DimensColumn[], sheetType: SheetType): Record<string, string> {
  const fieldMapping: Record<string, string> = {};
  for (const colConfig of SHEET_CONFIGS[sheetType].columns) {
    const existing = columns.find((c) => c.label === colConfig.label);
    if (existing) {
      fieldMapping[colConfig.key] = existing.fieldId;
    }
  }
  return fieldMapping;
}

function formatColumnEnsureError(prefix: string, missing: string[], errors: string[]): string {
  const parts = [`${prefix}：${missing.join('、')}`];
  if (errors.length > 0) {
    parts.push(`字段创建失败原因：${errors.slice(0, 5).join('；')}${errors.length > 5 ? `；另有 ${errors.length - 5} 个错误` : ''}`);
  }
  return parts.join('。');
}

export async function ensureColumns(
  teamId: string,
  projectId: string,
  sheetId: string,
  sheetType: SheetType
): Promise<{ fieldMapping: Record<string, string>; missing: string[]; created: string[]; errors: string[] }> {
  let columns = await listColumns(teamId, projectId, sheetId);
  const created: string[] = [];
  const errors: string[] = [];

  for (const colConfig of SHEET_CONFIGS[sheetType].columns) {
    const existing = columns.find((c) => c.label === colConfig.label);
    if (existing) continue;

    try {
      const fieldId = await createColumn(teamId, projectId, sheetId, colConfig.label, colConfig.type);
      if (fieldId) {
        columns = [...columns, { fieldId, label: colConfig.label, type: colConfig.type }];
      }
      created.push(colConfig.label);
    } catch (e: any) {
      errors.push(`创建字段 "${colConfig.label}" 失败：${e.message || String(e)}`);
    }
  }

  // Some column APIs return asynchronously or do not echo the created field id. Read back once
  // before deciding whether fields are truly missing.
  if (created.length > 0) {
    try {
      columns = await listColumns(teamId, projectId, sheetId);
    } catch (e: any) {
      errors.push(`重新读取字段列表失败：${e.message || String(e)}`);
    }
  }

  const fieldMapping = buildFieldMapping(columns, sheetType);
  const missing = SHEET_CONFIGS[sheetType].columns
    .filter((col) => !fieldMapping[col.key])
    .map((col) => col.label);

  return { fieldMapping, missing, created, errors };
}

export async function saveSheetTarget(sheetType: SheetType, sheet: DimensSheet): Promise<DimensSheetTarget> {
  const config = await getConfig();
  const projectId = config.projectId || await getConfiguredProjectId();
  const columns = await listColumns(config.teamId, projectId, sheet.sheetId);
  const fieldMapping = buildFieldMapping(columns, sheetType);
  const target: DimensSheetTarget = {
    sheetId: sheet.sheetId,
    sheetName: sheet.name,
    fieldMapping,
    upsertKeys: SHEET_CONFIGS[sheetType].primaryKeys,
    checkedAt: Date.now(),
  };

  await saveConfig({
    ...config,
    projectId,
    sheetTargets: {
      ...(config.sheetTargets || {}),
      [sheetType]: target,
    },
  });

  return target;
}

export async function clearSheetTarget(sheetType: SheetType): Promise<void> {
  const config = await getConfig();
  const sheetTargets = { ...(config.sheetTargets || {}) };
  delete sheetTargets[sheetType];
  await saveConfig({
    ...config,
    sheetTargets,
  });
}

export async function createStandardSheetForType(sheetType: SheetType, sheetName?: string): Promise<DimensSheetTarget> {
  const config = await getConfig();
  const projectId = await getConfiguredProjectId();
  const sheetConfig = SHEET_CONFIGS[sheetType];
  const name = sheetName?.trim() || sheetConfig.name;
  const sheetId = await createSheet(projectId, name);
  const ensured = await ensureColumns(config.teamId, projectId, sheetId, sheetType);
  if (ensured.missing.length > 0) {
    throw new Error(formatColumnEnsureError('标准表已创建，但以下字段未能补齐', ensured.missing, ensured.errors));
  }

  const target: DimensSheetTarget = {
    sheetId,
    sheetName: name,
    fieldMapping: ensured.fieldMapping,
    upsertKeys: sheetConfig.primaryKeys,
    checkedAt: Date.now(),
  };

  await saveConfig({
    ...config,
    projectId,
    sheetTargets: {
      ...(config.sheetTargets || {}),
      [sheetType]: target,
    },
  });

  return target;
}

export async function ensureSheet(sheetType: SheetType): Promise<{ sheetId: string; fieldMapping: Record<string, string> }> {
  const config = await getConfig();
  const projectId = config.projectId || await ensureProject();
  const sheetConfig = SHEET_CONFIGS[sheetType];
  const configured = config.sheetTargets?.[sheetType];

  let sheetId = configured?.sheetId;
  if (!sheetId) {
    const sheets = await listSheets(projectId);
    const sheet = sheets.find((s) => s.name === sheetConfig.name);
    sheetId = sheet?.sheetId || await createSheet(projectId, sheetConfig.name);
  }

  const ensured = await ensureColumns(config.teamId, projectId, sheetId, sheetType);
  if (ensured.missing.length > 0) {
    throw new Error(formatColumnEnsureError('目标表缺少字段', ensured.missing, ensured.errors));
  }

  return { sheetId, fieldMapping: ensured.fieldMapping };
}

function normalizeValueForCreate(value: any): any {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? '是' : '否';
  return value;
}

function normalizeValueForUpdate(value: any): any {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : undefined;
  if (typeof value === 'boolean') return value ? '是' : '否';
  return value;
}

function mapRowData(
  item: Record<string, any>,
  fieldMapping: Record<string, string>,
  mode: 'create' | 'update'
): Record<string, any> {
  const rowData: Record<string, any> = {};
  for (const [key, fieldId] of Object.entries(fieldMapping)) {
    const value = mode === 'create'
      ? normalizeValueForCreate(item[key])
      : normalizeValueForUpdate(item[key]);
    if (value !== undefined) {
      rowData[fieldId] = value;
    }
  }
  return rowData;
}

function buildBusinessKey(item: Record<string, any>, sheetType: SheetType): string | null {
  const keys = SHEET_CONFIGS[sheetType].primaryKeys;
  const values = keys.map((key) => item[key]);
  if (values.some((value) => value === undefined || value === null || value === '')) return null;
  return values.map(String).join('::');
}

function parseRows(result: any): any[] {
  const data = result.data || result || {};
  const list = data.list || data.rows || data.records || data;
  return Array.isArray(list) ? list : [];
}

function normalizeDimensRow(row: any): DimensRow {
  const rowData = row.data || row.values || {};
  return {
    rowId: row.rowId || row.id || rowData.id,
    data: rowData,
    version: row.version ?? rowData.version,
  };
}

async function findExistingRowByKey(
  teamId: string,
  projectId: string,
  sheetId: string,
  sheetType: SheetType,
  fieldMapping: Record<string, string>,
  item: Record<string, any>
): Promise<DimensRow | null> {
  const filters = SHEET_CONFIGS[sheetType].primaryKeys.map((key) => ({
    fieldId: fieldMapping[key],
    operator: 'equals',
    value: item[key],
  }));

  if (filters.some((filter) => !filter.fieldId || filter.value === undefined || filter.value === null || filter.value === '')) {
    return null;
  }

  const result = await proxyRequest(
    'POST',
    `/app/mul/${teamId}/${projectId}/sheet/${sheetId}/row/page`,
    {
      page: 1,
      size: 2,
      filters,
      filterMatchType: 'and',
    }
  );
  const rows = parseRows(result);
  return rows.length > 0 ? normalizeDimensRow(rows[0]) : null;
}

async function createRow(sheetId: string, data: Record<string, any>): Promise<void> {
  await proxyRequest('POST', `/app/mul/sheet/${sheetId}/row/create`, { data });
}

async function getRowInfo(teamId: string, projectId: string, sheetId: string, rowId: string): Promise<DimensRow> {
  const result = await proxyRequest(
    'GET',
    `/app/mul/${teamId}/${projectId}/sheet/${sheetId}/row/${rowId}/info`
  );
  const data = result.data || result;
  return normalizeDimensRow(data);
}

async function ensureRowVersion(teamId: string, projectId: string, sheetId: string, row: DimensRow): Promise<DimensRow> {
  if (row.version !== undefined && row.version !== null && row.version !== '') {
    return row;
  }
  if (!row.rowId) {
    throw new Error('无法更新已有行：缺少 rowId');
  }
  const rowInfo = await getRowInfo(teamId, projectId, sheetId, row.rowId);
  if (rowInfo.version === undefined || rowInfo.version === null || rowInfo.version === '') {
    throw new Error('无法更新已有行：未获取到行版本 version');
  }
  return rowInfo;
}

async function updateRow(
  teamId: string,
  projectId: string,
  sheetId: string,
  row: DimensRow,
  updates: Record<string, any>
): Promise<void> {
  const currentRow = await ensureRowVersion(teamId, projectId, sheetId, row);
  const version = Number(currentRow.version);
  await proxyRequest('POST', `/app/mul/sheet/${sheetId}/row/${currentRow.rowId}/update`, {
    data: mergeRowData(currentRow.data, updates),
    version,
  });
}

function mergeRowData(existing: Record<string, any>, updates: Record<string, any>): Record<string, any> {
  return {
    ...existing,
    ...updates,
  };
}

export async function importRows(
  sheetType: SheetType,
  sheetId: string,
  fieldMapping: Record<string, string>,
  data: Record<string, any>[],
  onProgress?: (completed: number, total: number) => void
): Promise<DimensImportResult> {
  const config = await getConfig();
  const projectId = config.projectId || await getConfiguredProjectId();
  const missingKeys = SHEET_CONFIGS[sheetType].primaryKeys.filter((key) => !fieldMapping[key]);
  if (missingKeys.length > 0) {
    throw new Error(`目标表缺少 Upsert 主键字段映射：${missingKeys.join('、')}`);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let index = 0; index < data.length; index += 1) {
    const item = data[index];
    const businessKey = buildBusinessKey(item, sheetType);
    if (!businessKey) {
      skipped += 1;
      errors.push(`第 ${index + 1} 条缺少主键字段，已跳过`);
      onProgress?.(index + 1, data.length);
      continue;
    }

    try {
      const existing = await findExistingRowByKey(config.teamId, projectId, sheetId, sheetType, fieldMapping, item);
      if (existing) {
        const updates = mapRowData(item, fieldMapping, 'update');
        if (Object.keys(updates).length === 0) {
          skipped += 1;
        } else {
          await updateRow(config.teamId, projectId, sheetId, existing, updates);
          updated += 1;
        }
      } else {
        await createRow(sheetId, mapRowData(item, fieldMapping, 'create'));
        created += 1;
      }
    } catch (e: any) {
      failed += 1;
      errors.push(`${businessKey}: ${e.message || String(e)}`);
    }

    onProgress?.(index + 1, data.length);
  }

  return {
    success: created + updated + skipped,
    created,
    updated,
    skipped,
    failed,
    errors,
  };
}

export async function checkConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const config = await getConfig();
    const result = await proxyRequest('POST', `/app/org/${config.teamId}/project/page`, {
      page: 1,
      size: 1,
    });
    const total = result.data?.total || 0;
    return { ok: true, message: '连接成功，共有 ' + total + ' 个项目' };
  } catch (e: any) {
    if (e.message?.includes('不是该团队成员')) {
      try {
        await checkAuth();
        const config = await getConfig();
        const result = await proxyRequest('POST', `/app/org/${config.teamId}/project/page`, {
          page: 1,
          size: 1,
        });
        const total = result.data?.total || 0;
        return { ok: true, message: '已切换到当前账号团队，共有 ' + total + ' 个项目' };
      } catch (retryError: any) {
        return { ok: false, message: retryError.message || '连接失败' };
      }
    }
    return { ok: false, message: e.message || '连接失败' };
  }
}

export async function getProjectInfo(): Promise<{ projectId: string; projectName: string } | null> {
  try {
    const config = await getConfig();
    const projectId = await getConfiguredProjectId();
    return { projectId, projectName: config.projectName || DEFAULT_PROJECT_NAME };
  } catch {
    return null;
  }
}

export async function createNewProject(name: string): Promise<DimensProject> {
  const config = await getConfig();
  return createProject(config.teamId, name);
}

export { DEFAULT_TEAM_ID, DEFAULT_PROJECT_NAME, DIMENS_BASE, STORAGE_KEY_AUTH, STORAGE_KEY_CONFIG, DIMENS_AUTH_REQUIRED, getAuth };
