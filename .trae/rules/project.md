# 智联采集 - 项目架构文档

## 一、项目概述

**项目名称**：智联采集（zhi-lian-cai-ji）  
**项目类型**：Chrome 浏览器扩展（基于 WXT 框架）  
**核心功能**：社媒数据采集助手，支持小红书、抖音、快手、TikTok 等平台的数据采集与导出

### 技术栈

| 类别 | 技术选型 |
|------|----------|
| 框架 | WXT 0.20.20（Chrome Extension 开发框架） |
| UI 框架 | React 18.3.1 |
| 状态管理 | Zustand 4.5.2 |
| 本地存储 | IndexedDB（idb 8.0.0） |
| 样式方案 | TailwindCSS 3.4.10 |
| 数据导出 | XLSX 0.18.5 |
| 虚拟列表 | @tanstack/react-virtual 3.5.0 |
| 拖拽排序 | @dnd-kit/core + @dnd-kit/sortable |
| 图标库 | lucide-react |
| 语言 | TypeScript 5.5.4 |

---

## 二、目录结构

```
src/
├── assets/styles/          # 全局样式
│   └── tailwind.css        # TailwindCSS 入口
├── config/                 # 配置文件
│   └── platforms.ts        # 平台配置（域名、颜色等）
├── entrypoints/            # 扩展入口点（WXT 约定）
│   ├── background/         # Service Worker 后台脚本
│   │   └── index.ts        # 消息处理、任务调度
│   ├── sidepanel/          # 侧边栏面板（主界面）
│   │   ├── components/     # 通用组件
│   │   ├── pages/          # 页面组件
│   │   ├── App.tsx         # 根组件
│   │   └── main.tsx        # 入口
│   ├── xhs.content/        # 小红书内容脚本
│   │   ├── extractor/      # 数据提取器
│   │   └── index.ts        # 主逻辑
│   ├── douyin.content/     # 抖音内容脚本
│   ├── kuaishou.content/   # 快手内容脚本
│   ├── pgy.content/        # 蒲公英平台内容脚本
│   └── xingtu.content/     # 星图平台内容脚本
└── shared/                 # 共享模块
    ├── db/                 # IndexedDB 数据库层
    ├── store/              # Zustand 状态管理
    ├── types/              # TypeScript 类型定义
    └── utils/              # 工具函数
```

---

## 三、核心架构设计

### 3.1 三层架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Content Script 层                         │
│  (xhs.content, douyin.content, kuaishou.content...)        │
│  职责：页面注入、DOM 操作、API 拦截、数据提取                │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ chrome.runtime.sendMessage
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Background Service Worker                 │
│  职责：消息路由、任务管理、数据库操作、下载管理              │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ chrome.sidePanel
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Sidepanel UI 层                           │
│  职责：数据展示、用户交互、导出配置、设置管理                │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 消息通信机制

项目使用 Chrome Extension Messaging API 进行组件间通信：

```typescript
// 消息类型定义 (src/shared/types/messages.ts)
type MessageType =
  | 'collect:post'        // 采集帖子
  | 'collect:author'      // 采集作者
  | 'collect:comments'    // 采集评论
  | 'download:media'      // 下载媒体
  | 'cache:posts'         // 缓存帖子列表
  | 'cache:author'        // 缓存作者信息
  | 'page:detected'       // 页面检测通知
  // ...

// 消息格式
interface Message<T = unknown> {
  type: MessageType;
  data?: T;
}

interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
```

---

## 四、数据模型设计

### 4.1 核心实体

```typescript
// 帖子实体
interface PostEntity {
  id: string;              // 主键
  platform: Platform;      // 平台标识
  postId: string;          // 平台帖子ID
  postType: PostType;      // 内容类型：video | image | mixed
  title: string;           // 标题
  content: string;         // 内容描述
  url: string;             // 帖子链接
  authorId?: string;       // 作者ID
  authorName?: string;     // 作者昵称
  likeCount?: number;      // 点赞数
  commentCount?: number;   // 评论数
  collectCount?: number;   // 收藏数
  shareCount?: number;     // 分享数
  tags?: string[];         // 标签
  collectedAt: string;     // 采集时间
  // ...更多字段
}

// 作者实体
interface AuthorEntity {
  id: string;
  platform: Platform;
  authorId: string;
  name: string;
  avatar?: string;
  profileUrl: string;
  fansCount?: number;
  followCount?: number;
  workCount?: number;
  // ...
}

// 评论实体
interface CommentEntity {
  id: string;
  platform: Platform;
  commentId: string;
  postId: string;
  content: string;
  authorName?: string;
  likeCount?: number;
  // ...
}

// 任务实体
interface TaskEntity {
  id: string;
  taskType: TaskType;
  status: TaskStatus;
  progress?: number;
  totalCount?: number;
  successCount?: number;
  // ...
}
```

### 4.2 平台枚举

```typescript
type Platform = 'xhs' | 'douyin' | 'kuaishou' | 'xingtu' | 'pgy' | 'tiktok';

type PageType = 
  | 'post_detail'      // 帖子详情页
  | 'author_profile'   // 作者主页
  | 'feed_list'        // 推荐列表
  | 'search_result'    // 搜索结果
  | 'unknown';

type TaskType =
  | 'collect_post'
  | 'collect_author'
  | 'collect_comments'
  | 'export_data'
  | 'download_media';

type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'canceled';
```

---

## 五、状态管理设计

### 5.1 Store 结构

项目使用 Zustand 进行状态管理，采用单一职责原则拆分 Store：

| Store | 职责 |
|-------|------|
| `postsStore` | 帖子数据管理、筛选、选择、导出 |
| `authorsStore` | 作者数据管理 |
| `commentsStore` | 评论数据管理 |
| `tasksStore` | 任务状态管理 |
| `settingsStore` | 用户设置管理 |
| `uiStore` | UI 状态（当前页面、弹窗状态等） |

### 5.2 Store 设计模式

```typescript
// 以 postsStore 为例
interface PostsState {
  // 状态
  posts: PostEntity[];
  total: number;
  selectedIds: string[];
  loading: boolean;
  filters: PostQueryOptions;
  
  // 操作
  fetchPosts: (options?: PostQueryOptions) => Promise<void>;
  setSelectedIds: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  deleteSelected: () => Promise<void>;
  setFilters: (filters: Partial<PostQueryOptions>) => void;
  getExportData: (scope: 'all' | 'filtered' | 'selected') => Promise<PostEntity[]>;
}
```

---

## 六、数据存储设计

### 6.1 IndexedDB Schema

```typescript
// 数据库名称：zhi-lian-cai-ji
// 数据库版本：动态管理

interface ZhiLianCaiJiDB {
  posts: {
    key: string;
    value: PostEntity;
    indexes: {
      'by-platform': string;
      'by-postId': string;
      'by-collectedAt': string;
      'by-platform-postId': [string, string]; // 复合唯一索引
    };
  };
  authors: {
    key: string;
    value: AuthorEntity;
    indexes: {
      'by-platform': string;
      'by-authorId': string;
      'by-platform-authorId': [string, string]; // 复合唯一索引
    };
  };
  comments: { /* 类似结构 */ };
  media: { /* 类似结构 */ };
  tasks: { /* 类似结构 */ };
  templates: { /* 导出模板 */ };
}
```

### 6.2 数据访问层

每个实体对应独立的数据访问模块：

- `src/shared/db/posts.ts` - 帖子 CRUD
- `src/shared/db/authors.ts` - 作者 CRUD
- `src/shared/db/comments.ts` - 评论 CRUD
- `src/shared/db/tasks.ts` - 任务 CRUD
- `src/shared/db/templates.ts` - 模板 CRUD

---

## 七、平台适配器模式

### 7.1 平台适配器接口

```typescript
interface PlatformAdapter {
  name: Platform;
  displayName: string;
  
  // 页面检测
  detectPage(url: string): PageType;
  
  // 数据提取方法
  extractPost(): Promise<ExtractResult<PostEntity>>;
  extractAuthor(): Promise<ExtractResult<AuthorEntity>>;
  extractComments(): Promise<ExtractResult<CommentEntity[]>>;
  extractPostList?(): Promise<ExtractResult<PostEntity[]>>;
  extractMedia?(): Promise<ExtractResult<MediaEntity[]>>;
}
```

### 7.2 平台配置

```typescript
const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  xhs: {
    name: 'xhs',
    displayName: '小红书',
    domains: ['www.xiaohongshu.com', 'xiaohongshu.com'],
    color: '#ff2442'
  },
  dy: {
    name: 'dy',
    displayName: '抖音',
    domains: ['www.douyin.com', 'douyin.com'],
    color: '#000000'
  },
  ks: {
    name: 'ks',
    displayName: '快手',
    domains: ['www.kuaishou.com', 'kuaishou.com'],
    color: '#ff4906'
  },
  // ...
};
```

---

## 八、数据导出设计

### 8.1 导出配置

```typescript
interface ExportRequest {
  targetType: ExportTarget;    // posts | authors | comments | media
  scope: ExportScope;          // all | filtered | selected
  format: ExportFormat;        // csv | excel | json
  fields: ExportFieldConfig[]; // 字段配置
  fileName: string;
  templateId?: string;
}

interface ExportFieldConfig {
  key: string;           // 字段名
  label: string;         // 显示名称
  customLabel?: string;  // 自定义标签
  enabled: boolean;      // 是否导出
  order: number;         // 排序
}
```

### 8.2 导出模板

支持保存导出配置为模板，便于重复使用：

```typescript
interface ExportTemplate {
  id: string;
  name: string;
  targetType: ExportTarget;
  format: ExportFormat;
  fields: ExportFieldConfig[];
  fileNameRule: string;
  autoAddDateSuffix: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

## 九、关键实现细节

### 9.1 XHR 拦截机制

Content Script 通过拦截 XMLHttpRequest 获取页面数据：

```typescript
function setupXhrInterceptor() {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._url = url.toString();
    return originalOpen.apply(this, [method, url, ...args]);
  };
  
  XMLHttpRequest.prototype.send = function(body) {
    if (isDataApiUrl(this._url)) {
      // 拦截响应并解析数据
      const originalOnReadyStateChange = this.onreadystatechange;
      this.onreadystatechange = function(ev) {
        if (this.readyState === 4 && this.status === 200) {
          const data = JSON.parse(this.responseText);
          handleApiData(this._url, data);
        }
        originalOnReadyStateChange?.call(this, ev);
      };
    }
    return originalSend.apply(this, [body]);
  };
}
```

### 9.2 页面变化监听

使用 MutationObserver 监听 SPA 路由变化：

```typescript
function observePageChanges() {
  let lastUrl = window.location.href;
  
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      const newPageType = detectPage(window.location.href);
      if (newPageType !== currentPageType) {
        onPageChanged(newPageType);
      }
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}
```

### 9.3 防抖缓存

批量缓存数据时使用防抖优化性能：

```typescript
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSavePosts() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (collectedPosts.size > 0) {
      sendMessage('cache:posts', { posts: Array.from(collectedPosts.values()) });
    }
    saveTimer = null;
  }, 1000);
}
```

---

## 十、扩展权限配置

```typescript
// wxt.config.ts
manifest: {
  permissions: [
    'activeTab',    // 活动标签页访问
    'downloads',    // 下载管理
    'scripting',    // 脚本注入
    'storage',      // 本地存储
    'sidePanel',    // 侧边栏
    'tabs',         // 标签页管理
    'alarms'        // 定时任务
  ],
  host_permissions: [
    'https://www.xiaohongshu.com/*',
    'https://pgy.xiaohongshu.com/*',
    'https://www.douyin.com/*',
    'https://star.toutiao.com/*',
    'https://www.kuaishou.com/*',
    'https://www.tiktok.com/*'
  ]
}
```

---

## 十一、设计模式应用

| 模式 | 应用场景 |
|------|----------|
| **单例模式** | IndexedDB 连接实例、全局状态 Store |
| **适配器模式** | 平台适配器（PlatformAdapter） |
| **观察者模式** | Zustand 状态订阅、MutationObserver 页面监听 |
| **策略模式** | 不同平台的数据提取策略 |
| **工厂模式** | 消息处理器创建 |
| **代理模式** | XHR 拦截代理 |

---

## 十二、开发规范

### 12.1 文件命名

- 组件文件：PascalCase（如 `ExportModal.tsx`）
- 工具文件：camelCase（如 `helpers.ts`）
- 类型文件：camelCase（如 `entities.ts`）
- Store 文件：xxxStore.ts（如 `postsStore.ts`）

### 12.2 代码组织

- 单文件代码不超过 700 行
- 共享类型集中管理在 `shared/types/`
- 平台相关代码隔离在各自的 content script 中
- 数据库操作封装在 `shared/db/` 层

### 12.3 路径别名

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## 十三、运行命令

```bash
# 开发模式
pnpm run dev

# 开发模式（Firefox）
pnpm run dev:firefox

# 构建生产版本
pnpm run build

# 打包扩展
pnpm run zip

# 类型检查
pnpm run compile

# 代码检查
pnpm run lint

# 代码格式化
pnpm run format
```

---

## 十四、AI 提示语使用指南

### 14.1 新增平台支持

当需要新增平台时，提示语示例：

```
请参考 src/entrypoints/xhs.content/index.ts 的实现，
为 [新平台名称] 创建 content script，需要：
1. 在 src/shared/types/index.ts 中添加平台标识
2. 在 src/config/platforms.ts 中添加平台配置
3. 在 wxt.config.ts 中添加 host_permissions
4. 实现 XHR 拦截和数据提取逻辑
```

### 14.2 新增数据实体

当需要新增数据实体时，提示语示例：

```
请参考现有的 PostEntity 实现，新增 [实体名称] 实体：
1. 在 src/shared/types/entities.ts 中定义实体接口
2. 在 src/shared/db/ 中创建对应的数据库访问模块
3. 在 src/shared/db/index.ts 中导出
4. 在 src/shared/store/ 中创建对应的 Store
5. 更新 IndexedDB Schema
```

### 14.3 新增导出格式

当需要新增导出格式时，提示语示例：

```
请参考现有的导出实现，新增 [格式名称] 导出支持：
1. 在 src/shared/types/index.ts 的 ExportFormat 中添加类型
2. 在导出模块中实现格式转换逻辑
3. 更新 ExportModal 组件的格式选项
```

---

*文档版本：1.0.0*  
*最后更新：2025-03-28*
