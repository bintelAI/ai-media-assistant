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
  teamId?: string;
  projectId?: string;
  projectName?: string;
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
  config?: Record<string, any>;
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
  deduped: number;
  dirtySkipped: number;
  errors: string[];
}

interface SelectOption {
  id: string;
  label: string;
  color: string;
}

interface SheetColumnConfig {
  label: string;
  type: string;
  key: string;
  options?: SelectOption[];
}

interface SheetConfig {
  name: string;
  primaryKeys: string[];
  columns: SheetColumnConfig[];
}

const PLATFORM_OPTIONS: SelectOption[] = [
  { id: 'xhs', label: '小红书', color: 'bg-rose-100 text-rose-700' },
  { id: 'douyin', label: '抖音', color: 'bg-slate-100 text-slate-700' },
  { id: 'kuaishou', label: '快手', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'xingtu', label: '星图', color: 'bg-blue-100 text-blue-700' },
  { id: 'pgy', label: '蒲公英', color: 'bg-violet-100 text-violet-700' },
  { id: 'tiktok', label: 'TikTok', color: 'bg-zinc-100 text-zinc-700' },
];

const POST_TYPE_OPTIONS: SelectOption[] = [
  { id: 'video', label: '视频', color: 'bg-blue-100 text-blue-700' },
  { id: 'image', label: '图文', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'mixed', label: '图文/视频', color: 'bg-violet-100 text-violet-700' },
  { id: 'text', label: '文本', color: 'bg-slate-100 text-slate-700' },
];

const GENDER_OPTIONS: SelectOption[] = [
  { id: 'male', label: '男', color: 'bg-blue-100 text-blue-700' },
  { id: 'female', label: '女', color: 'bg-rose-100 text-rose-700' },
  { id: 'unknown', label: '未知', color: 'bg-slate-100 text-slate-700' },
];

const SHEET_CONFIGS: Record<SheetType, SheetConfig> = {
  posts: {
    name: '帖子数据',
    primaryKeys: ['platform', 'postId'],
    columns: [
      { label: '平台', type: 'select', key: 'platform', options: PLATFORM_OPTIONS },
      { label: '帖子ID', type: 'text', key: 'postId' },
      { label: '内容类型', type: 'select', key: 'postType', options: POST_TYPE_OPTIONS },
      { label: '标题', type: 'text', key: 'title' },
      { label: '内容描述', type: 'text', key: 'content' },
      { label: '帖子链接', type: 'url', key: 'url' },
      { label: '封面图', type: 'url', key: 'coverUrl' },
      { label: '发布时间', type: 'date', key: 'publishTime' },
      { label: '作者ID', type: 'text', key: 'authorId' },
      { label: '作者昵称', type: 'text', key: 'authorName' },
      { label: '作者主页链接', type: 'url', key: 'authorUrl' },
      { label: '点赞数', type: 'number', key: 'likeCount' },
      { label: '评论数', type: 'number', key: 'commentCount' },
      { label: '收藏数', type: 'number', key: 'collectCount' },
      { label: '分享数', type: 'number', key: 'shareCount' },
      { label: '播放数', type: 'number', key: 'viewCount' },
      { label: '媒体数量', type: 'number', key: 'mediaCount' },
      { label: '标签', type: 'text', key: 'tags' },
      { label: '来源页面', type: 'url', key: 'sourcePageUrl' },
      { label: '采集时间', type: 'date', key: 'collectedAt' },
      { label: '更新时间', type: 'date', key: 'updatedAt' },
      { label: '备注', type: 'text', key: 'note' },
    ],
  },
  authors: {
    name: '作者数据',
    primaryKeys: ['platform', 'authorId'],
    columns: [
      { label: '平台', type: 'select', key: 'platform', options: PLATFORM_OPTIONS },
      { label: '作者ID', type: 'text', key: 'authorId' },
      { label: '昵称', type: 'text', key: 'name' },
      { label: '头像', type: 'url', key: 'avatar' },
      { label: '主页链接', type: 'url', key: 'profileUrl' },
      { label: '简介', type: 'text', key: 'bio' },
      { label: '粉丝数', type: 'number', key: 'fansCount' },
      { label: '关注数', type: 'number', key: 'followCount' },
      { label: '获赞数', type: 'number', key: 'likedCount' },
      { label: '作品数', type: 'number', key: 'workCount' },
      { label: '地区', type: 'text', key: 'location' },
      { label: '性别', type: 'select', key: 'gender', options: GENDER_OPTIONS },
      { label: '是否认证', type: 'checkbox', key: 'verified' },
      { label: '认证说明', type: 'text', key: 'verifiedDesc' },
      { label: '联系方式', type: 'text', key: 'contactInfo' },
      { label: '来源页面', type: 'url', key: 'sourcePageUrl' },
      { label: '采集时间', type: 'date', key: 'collectedAt' },
      { label: '更新时间', type: 'date', key: 'updatedAt' },
      { label: '备注', type: 'text', key: 'note' },
    ],
  },
  comments: {
    name: '评论数据',
    primaryKeys: ['platform', 'commentId'],
    columns: [
      { label: '平台', type: 'select', key: 'platform', options: PLATFORM_OPTIONS },
      { label: '评论ID', type: 'text', key: 'commentId' },
      { label: '所属帖子ID', type: 'text', key: 'postId' },
      { label: '所属帖子标题', type: 'text', key: 'postTitle' },
      { label: '评论用户ID', type: 'text', key: 'authorId' },
      { label: '评论用户昵称', type: 'text', key: 'authorName' },
      { label: '评论内容', type: 'text', key: 'content' },
      { label: '点赞数', type: 'number', key: 'likeCount' },
      { label: '回复数', type: 'number', key: 'replyCount' },
      { label: '发布时间', type: 'date', key: 'publishTime' },
      { label: '来源页面', type: 'url', key: 'sourcePageUrl' },
      { label: '采集时间', type: 'date', key: 'collectedAt' },
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

export async function openDimensAuthorizedPage(url: string): Promise<void> {
  const response = await sendMessage('dimens:open-authorized-page', { url });
  if (!response.success) {
    throw new Error(response.error || '打开维表页面失败');
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

function pickList(result: any, keys: string[] = []): any[] {
  const data = result?.data ?? result ?? {};
  if (Array.isArray(data)) return data;

  for (const key of [...keys, 'list', 'records', 'rows', 'items']) {
    if (Array.isArray(data[key])) return data[key];
  }

  return [];
}

export async function listProjects(teamId?: string): Promise<DimensProject[]> {
  const config = await getConfig();
  const tid = teamId || config.teamId;
  const result = await proxyRequest('POST', `/app/org/${tid}/project/page`, {
    page: 1,
    size: 50,
  });
  const list = pickList(result, ['projects']);
  return (Array.isArray(list) ? list : []).map((p: any) => ({
    id: p.id || p.projectId,
    name: p.name || p.projectName || p.title,
  })).filter((p) => p.id && p.name);
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
  return {
    id: data.id || data.projectId || data.project?.id || data.project?.projectId,
    name: data.name || data.projectName || data.project?.name || data.project?.projectName || pname,
  };
}

async function ensureProject(): Promise<string> {
  const config = await getConfig();
  const previousProjectId = config.projectId;
  if (config.projectId) {
    try {
      const projects = await listProjects(config.teamId);
      const project = projects.find((p) => p.id === config.projectId);
      if (project) {
        if (project.name !== config.projectName) {
          await saveConfig({ ...config, projectName: project.name });
        }
        return project.id;
      }
    } catch {
      return config.projectId;
    }
  }

  let project = await findProject(config.teamId, config.projectName);
  if (!project) {
    project = await createProject(config.teamId, config.projectName);
  }

  await saveConfig({
    ...config,
    projectId: project.id,
    projectName: project.name,
    sheetTargets: previousProjectId && previousProjectId !== project.id ? {} : config.sheetTargets,
  });
  return project.id;
}

export async function listSheets(projectId: string): Promise<DimensSheet[]> {
  const result = await proxyRequest('GET', `/app/mul/project/${projectId}/sheet/list`);
  const list = pickList(result, ['sheets']);
  return list
    .filter((s: any) => s.type === 'sheet' || !s.type)
    .map((s: any) => ({
      sheetId: s.sheetId || s.id,
      name: s.name || s.sheetName || s.title || '',
      type: s.type || 'sheet',
      columns: s.config?.columns
        ?.filter((c: any) => !(c.fieldId || c.id || '').startsWith('__system'))
        .map((c: any) => ({
          fieldId: c.fieldId || c.id,
          label: c.label || c.title || '',
          type: c.type || 'text',
          config: c.config || c.property || {},
        })) || [],
    }));
}

async function createSheet(projectId: string, name: string): Promise<string> {
  const result = await proxyRequest('POST', `/app/mul/project/${projectId}/sheet/create`, { name });
  const data = result.data || result;
  const sheetId = data.id || data.sheetId || data.sheet?.id || data.sheet?.sheetId;
  if (!sheetId) {
    throw new Error('标准表创建成功但未返回 sheetId');
  }
  return sheetId;
}

async function createColumn(
  teamId: string,
  projectId: string,
  sheetId: string,
  column: SheetColumnConfig
): Promise<string> {
  const body: Record<string, any> = { label: column.label, type: column.type };
  if (column.options?.length) {
    body.config = { options: column.options };
  }

  const result = await proxyRequest(
    'POST',
    `/app/mul/${teamId}/${projectId}/sheet/${sheetId}/column/create`,
    body
  );
  const data = result.data || result;
  return data.id || data.fieldId;
}

export async function listColumns(teamId: string, projectId: string, sheetId: string): Promise<DimensColumn[]> {
  const result = await proxyRequest(
    'GET',
    `/app/mul/${teamId}/${projectId}/sheet/${sheetId}/column/list`
  );
  return pickList(result, ['columns', 'fields'])
    .filter((c: any) => !(c.id || c.fieldId || '').startsWith('__system'))
    .map((c: any) => ({
      fieldId: c.id || c.fieldId,
      label: c.label || c.title || c.name || '',
      type: c.type || 'text',
      config: c.config || c.property || {},
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
      const fieldId = await createColumn(teamId, projectId, sheetId, colConfig);
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
  const projectId = config.projectId || await ensureProject();
  const latestConfig = await getConfig();
  const columns = await listColumns(latestConfig.teamId, projectId, sheet.sheetId);
  const fieldMapping = buildFieldMapping(columns, sheetType);
  const target: DimensSheetTarget = {
    sheetId: sheet.sheetId,
    sheetName: sheet.name,
    teamId: latestConfig.teamId,
    projectId,
    projectName: latestConfig.projectName || DEFAULT_PROJECT_NAME,
    fieldMapping,
    upsertKeys: SHEET_CONFIGS[sheetType].primaryKeys,
    checkedAt: Date.now(),
  };

  await saveConfig({
    ...latestConfig,
    projectId,
    sheetTargets: {
      ...(latestConfig.sheetTargets || {}),
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
  const projectId = await ensureProject();
  const config = await getConfig();
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
    teamId: config.teamId,
    projectId,
    projectName: config.projectName || DEFAULT_PROJECT_NAME,
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

export async function ensureSheetTarget(sheetType: SheetType): Promise<DimensSheetTarget> {
  const projectId = await ensureProject();
  const config = await getConfig();
  const sheetConfig = SHEET_CONFIGS[sheetType];
  const configured = config.sheetTargets?.[sheetType];
  const sheets = await listSheets(projectId);

  let sheet = configured?.sheetId
    ? sheets.find((item) => item.sheetId === configured.sheetId)
    : undefined;

  if (!sheet) {
    sheet = sheets.find((item) => item.name === sheetConfig.name);
  }

  const sheetId = sheet?.sheetId || await createSheet(projectId, sheetConfig.name);
  const sheetName = sheet?.name || sheetConfig.name;

  const ensured = await ensureColumns(config.teamId, projectId, sheetId, sheetType);
  if (ensured.missing.length > 0) {
    throw new Error(formatColumnEnsureError('目标表缺少字段', ensured.missing, ensured.errors));
  }

  const target: DimensSheetTarget = {
    sheetId,
    sheetName,
    teamId: config.teamId,
    projectId,
    projectName: config.projectName || DEFAULT_PROJECT_NAME,
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
  const target = await ensureSheetTarget(sheetType);
  return { sheetId: target.sheetId, fieldMapping: target.fieldMapping };
}

function getColumnConfigByKey(sheetType: SheetType, key: string): SheetColumnConfig | undefined {
  return SHEET_CONFIGS[sheetType].columns.find((column) => column.key === key);
}

function normalizeString(value: any): string {
  return String(value ?? '').trim();
}

function normalizeOptionValue(value: any, options: SelectOption[]): string {
  const raw = normalizeString(value);
  if (!raw) return '';
  const lower = raw.toLowerCase();
  const option = options.find((item) => item.id.toLowerCase() === lower || item.label === raw);
  return option?.id || raw;
}

function formatOptionLabel(value: any, options: SelectOption[]): string {
  const raw = normalizeString(value);
  if (!raw) return '';
  const normalized = normalizeOptionValue(raw, options);
  return options.find((item) => item.id === normalized)?.label || raw;
}

function canonicalizeFieldValue(key: string, value: any): string {
  if (key === 'platform') return normalizeOptionValue(value, PLATFORM_OPTIONS);
  if (key === 'postType') return normalizeOptionValue(value, POST_TYPE_OPTIONS);
  if (key === 'gender') return normalizeOptionValue(value, GENDER_OPTIONS);
  return normalizeString(value);
}

function formatFieldValueForDimens(sheetType: SheetType, key: string, value: any): any {
  const column = getColumnConfigByKey(sheetType, key);
  if (column?.options?.length) {
    return formatOptionLabel(value, column.options);
  }
  return value;
}

function isEmptyDimensValue(value: any): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
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
  sheetType: SheetType,
  item: Record<string, any>,
  fieldMapping: Record<string, string>,
  mode: 'create' | 'update'
): Record<string, any> {
  const rowData: Record<string, any> = {};
  for (const [key, fieldId] of Object.entries(fieldMapping)) {
    const formattedValue = formatFieldValueForDimens(sheetType, key, item[key]);
    const value = mode === 'create'
      ? normalizeValueForCreate(formattedValue)
      : normalizeValueForUpdate(formattedValue);
    if (value !== undefined) {
      rowData[fieldId] = value;
    }
  }
  return rowData;
}

function buildBusinessKey(item: Record<string, any>, sheetType: SheetType): string | null {
  const keys = SHEET_CONFIGS[sheetType].primaryKeys;
  const values = keys.map((key) => canonicalizeFieldValue(key, item[key]));
  if (values.some((value) => !value)) return null;
  return values.join('::');
}

function parseRows(result: any): any[] {
  const candidates = [
    result,
    result?.data,
    result?.data?.data,
    result?.data?.page,
    result?.page,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (!candidate || typeof candidate !== 'object') continue;
    for (const key of ['list', 'rows', 'records', 'items']) {
      if (Array.isArray(candidate[key])) return candidate[key];
    }
  }

  return [];
}

function normalizeCellArray(cells: any[]): Record<string, any> {
  const data: Record<string, any> = {};
  for (const cell of cells) {
    const fieldId = cell?.fieldId || cell?.columnId || cell?.id || cell?.key;
    if (!fieldId) continue;
    data[fieldId] = cell.value ?? cell.text ?? cell.label ?? cell.data ?? '';
  }
  return data;
}

function normalizeDimensRow(row: any): DimensRow {
  const rawData = row.data || row.values || row.fields || row.record || {};
  const rowData = Array.isArray(row.cells)
    ? { ...rawData, ...normalizeCellArray(row.cells) }
    : rawData;
  const rowId = row.rowId || row.id || row._id || rowData.rowId || rowData.id;
  return {
    rowId: rowId || '',
    data: rowData || {},
    version: row.version ?? rowData.version ?? row.baseVersion,
  };
}

function getRemoteFieldValue(row: DimensRow, fieldId: string): any {
  const value = row.data?.[fieldId];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value.label ?? value.value ?? value.text ?? value.id ?? '';
  }
  return value;
}

function rowMatchesBusinessKey(
  row: DimensRow,
  sheetType: SheetType,
  fieldMapping: Record<string, string>,
  item: Record<string, any>
): boolean {
  return SHEET_CONFIGS[sheetType].primaryKeys.every((key) => {
    const fieldId = fieldMapping[key];
    if (!fieldId) return false;
    const expected = canonicalizeFieldValue(key, item[key]);
    const actual = canonicalizeFieldValue(key, getRemoteFieldValue(row, fieldId));
    return expected !== '' && expected === actual;
  });
}

async function rowPage(
  teamId: string,
  projectId: string,
  sheetId: string,
  body: Record<string, any>
): Promise<DimensRow[]> {
  const result = await proxyRequest(
    'POST',
    `/app/mul/${teamId}/${projectId}/sheet/${sheetId}/row/page`,
    body
  );
  return parseRows(result).map(normalizeDimensRow).filter((row) => row.rowId);
}

async function findExistingRowByKey(
  teamId: string,
  projectId: string,
  sheetId: string,
  sheetType: SheetType,
  fieldMapping: Record<string, string>,
  item: Record<string, any>
): Promise<DimensRow | null> {
  const primaryKeys = SHEET_CONFIGS[sheetType].primaryKeys;
  const idKey = primaryKeys.find((key) => key !== 'platform') || primaryKeys[0];
  const idFieldId = fieldMapping[idKey];
  const idValue = item[idKey];
  if (!idFieldId || idValue === undefined || idValue === null || idValue === '') {
    return null;
  }

  const queryBodies = [
    {
      page: 1,
      size: 20,
      filters: [{ fieldId: idFieldId, operator: 'equals', value: idValue }],
      filterMatchType: 'and',
    },
    {
      page: 1,
      size: 20,
      filters: primaryKeys.map((key) => ({
        fieldId: fieldMapping[key],
        operator: 'equals',
        value: formatFieldValueForDimens(sheetType, key, item[key]),
      })),
      filterMatchType: 'and',
    },
  ];

  for (const body of queryBodies) {
    if (body.filters.some((filter) => !filter.fieldId || isEmptyDimensValue(filter.value))) continue;
    const rows = await rowPage(teamId, projectId, sheetId, body);
    const match = rows.find((row) => rowMatchesBusinessKey(row, sheetType, fieldMapping, item));
    if (match) return match;
  }

  return null;
}

function buildBusinessKeyFromRow(
  row: DimensRow,
  sheetType: SheetType,
  fieldMapping: Record<string, string>
): string | null {
  const item: Record<string, any> = {};
  for (const key of SHEET_CONFIGS[sheetType].primaryKeys) {
    const fieldId = fieldMapping[key];
    item[key] = fieldId ? getRemoteFieldValue(row, fieldId) : '';
  }
  return buildBusinessKey(item, sheetType);
}

async function buildRemoteRowIndex(
  teamId: string,
  projectId: string,
  sheetId: string,
  sheetType: SheetType,
  fieldMapping: Record<string, string>
): Promise<Map<string, DimensRow>> {
  const index = new Map<string, DimensRow>();
  const pageSize = 100;
  const maxPages = 10;

  for (let page = 1; page <= maxPages; page += 1) {
    const rows = await rowPage(teamId, projectId, sheetId, {
      page,
      size: pageSize,
    });

    for (const row of rows) {
      const businessKey = buildBusinessKeyFromRow(row, sheetType, fieldMapping);
      if (businessKey && !index.has(businessKey)) {
        index.set(businessKey, row);
      }
    }

    if (rows.length < pageSize) break;
  }

  return index;
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
  const merged = { ...existing };
  for (const [fieldId, value] of Object.entries(updates)) {
    if (!isEmptyDimensValue(value)) {
      merged[fieldId] = value;
    }
  }
  return merged;
}

export async function importRows(
  sheetType: SheetType,
  sheetId: string,
  fieldMapping: Record<string, string>,
  data: Record<string, any>[],
  onProgress?: (completed: number, total: number) => void
): Promise<DimensImportResult> {
  const config = await getConfig();
  const projectId = config.projectId || await ensureProject();
  const latestConfig = await getConfig();
  const missingKeys = SHEET_CONFIGS[sheetType].primaryKeys.filter((key) => !fieldMapping[key]);
  if (missingKeys.length > 0) {
    throw new Error(`目标表缺少 Upsert 主键字段映射：${missingKeys.join('、')}`);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let deduped = 0;
  let dirtySkipped = 0;
  const errors: string[] = [];
  const processedKeys = new Set<string>();
  const rowCache = new Map<string, DimensRow | null>();
  let remoteRowIndex: Map<string, DimensRow> | null = null;

  for (let index = 0; index < data.length; index += 1) {
    const item = data[index];
    const businessKey = buildBusinessKey(item, sheetType);
    if (!businessKey) {
      skipped += 1;
      dirtySkipped += 1;
      errors.push(`第 ${index + 1} 条缺少主键字段，已跳过`);
      onProgress?.(index + 1, data.length);
      continue;
    }

    if (processedKeys.has(businessKey)) {
      skipped += 1;
      deduped += 1;
      errors.push(`${businessKey}: 同批次重复数据，已跳过`);
      onProgress?.(index + 1, data.length);
      continue;
    }
    processedKeys.add(businessKey);

    try {
      const existing = rowCache.has(businessKey)
        ? rowCache.get(businessKey) || null
        : await findExistingRowByKey(latestConfig.teamId, projectId, sheetId, sheetType, fieldMapping, item);
      let matchedRow = existing;
      if (!matchedRow) {
        if (!remoteRowIndex) {
          remoteRowIndex = await buildRemoteRowIndex(latestConfig.teamId, projectId, sheetId, sheetType, fieldMapping);
        }
        matchedRow = remoteRowIndex.get(businessKey) || null;
      }
      rowCache.set(businessKey, matchedRow);

      if (matchedRow) {
        const updates = mapRowData(sheetType, item, fieldMapping, 'update');
        if (Object.keys(updates).length === 0) {
          skipped += 1;
        } else {
          await updateRow(latestConfig.teamId, projectId, sheetId, matchedRow, updates);
          updated += 1;
        }
      } else {
        await createRow(sheetId, mapRowData(sheetType, item, fieldMapping, 'create'));
        created += 1;
        remoteRowIndex?.set(businessKey, { rowId: '', data: {}, version: undefined });
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
    deduped,
    dirtySkipped,
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
    const projectId = await ensureProject();
    const config = await getConfig();
    return { projectId, projectName: config.projectName || DEFAULT_PROJECT_NAME };
  } catch {
    return null;
  }
}

export async function getSheetViewUrl(sheetId: string, target?: Partial<DimensSheetTarget>): Promise<string> {
  const config = await getConfig();
  const projectId = target?.projectId || config.projectId || await ensureProject();
  const latestConfig = await getConfig();
  const teamId = target?.teamId || latestConfig.teamId;
  if (!target?.projectId || !target?.teamId) {
    const sheets = await listSheets(projectId);
    if (!sheets.some((sheet) => sheet.sheetId === sheetId)) {
      throw new Error('目标表不属于当前项目，请重新选择目标表后再打开');
    }
  }
  return `https://dimens.bintelai.com/#/${teamId}/${projectId}/${sheetId}`;
}

export async function createNewProject(name: string): Promise<DimensProject> {
  const config = await getConfig();
  return createProject(config.teamId, name);
}

export { DEFAULT_TEAM_ID, DEFAULT_PROJECT_NAME, DIMENS_BASE, STORAGE_KEY_AUTH, STORAGE_KEY_CONFIG, DIMENS_AUTH_REQUIRED, getAuth };
