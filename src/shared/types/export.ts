import type { ExportFormat, ExportScope, ExportTarget } from './index';

export interface ExportFieldConfig {
  key: string;
  label: string;
  customLabel?: string;
  enabled: boolean;
  order: number;
}

export interface ExportTemplate {
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

export interface ExportRequest {
  targetType: ExportTarget;
  scope: ExportScope;
  format: ExportFormat;
  fields: ExportFieldConfig[];
  fileName: string;
  templateId?: string;
}

export interface ExportFieldGroup {
  group: string;
  label: string;
  fields: ExportFieldConfig[];
}

export const POST_EXPORT_FIELDS: ExportFieldConfig[] = [
  { key: 'platform', label: '平台', enabled: true, order: 1 },
  { key: 'postId', label: '帖子ID', enabled: false, order: 2 },
  { key: 'postType', label: '内容类型', enabled: true, order: 3 },
  { key: 'title', label: '标题', enabled: true, order: 4 },
  { key: 'content', label: '内容描述', enabled: true, order: 5 },
  { key: 'url', label: '帖子链接', enabled: true, order: 6 },
  { key: 'coverUrl', label: '封面图', enabled: false, order: 7 },
  { key: 'publishTime', label: '发布时间', enabled: true, order: 8 },
  { key: 'authorId', label: '作者ID', enabled: false, order: 9 },
  { key: 'authorName', label: '作者昵称', enabled: true, order: 10 },
  { key: 'authorUrl', label: '作者主页链接', enabled: false, order: 11 },
  { key: 'likeCount', label: '点赞数', enabled: true, order: 12 },
  { key: 'commentCount', label: '评论数', enabled: true, order: 13 },
  { key: 'collectCount', label: '收藏数', enabled: false, order: 14 },
  { key: 'shareCount', label: '分享数', enabled: false, order: 15 },
  { key: 'viewCount', label: '播放数', enabled: false, order: 16 },
  { key: 'mediaCount', label: '媒体数量', enabled: false, order: 17 },
  { key: 'tags', label: '标签', enabled: false, order: 18 },
  { key: 'sourcePageUrl', label: '来源页面', enabled: false, order: 19 },
  { key: 'collectedAt', label: '采集时间', enabled: true, order: 20 },
  { key: 'updatedAt', label: '更新时间', enabled: false, order: 21 },
  { key: 'note', label: '备注', enabled: false, order: 22 }
];

export const AUTHOR_EXPORT_FIELDS: ExportFieldConfig[] = [
  { key: 'platform', label: '平台', enabled: true, order: 1 },
  { key: 'authorId', label: '作者ID', enabled: false, order: 2 },
  { key: 'name', label: '昵称', enabled: true, order: 3 },
  { key: 'avatar', label: '头像', enabled: false, order: 4 },
  { key: 'profileUrl', label: '主页链接', enabled: true, order: 5 },
  { key: 'bio', label: '简介', enabled: false, order: 6 },
  { key: 'fansCount', label: '粉丝数', enabled: true, order: 7 },
  { key: 'followCount', label: '关注数', enabled: false, order: 8 },
  { key: 'likedCount', label: '获赞数', enabled: false, order: 9 },
  { key: 'workCount', label: '作品数', enabled: true, order: 10 },
  { key: 'location', label: '地区', enabled: false, order: 11 },
  { key: 'gender', label: '性别', enabled: false, order: 12 },
  { key: 'verified', label: '是否认证', enabled: false, order: 13 },
  { key: 'verifiedDesc', label: '认证说明', enabled: false, order: 14 },
  { key: 'contactInfo', label: '联系方式', enabled: false, order: 15 },
  { key: 'sourcePageUrl', label: '来源页面', enabled: false, order: 16 },
  { key: 'collectedAt', label: '采集时间', enabled: true, order: 17 },
  { key: 'updatedAt', label: '更新时间', enabled: false, order: 18 },
  { key: 'note', label: '备注', enabled: false, order: 19 }
];

export const COMMENT_EXPORT_FIELDS: ExportFieldConfig[] = [
  { key: 'platform', label: '平台', enabled: true, order: 1 },
  { key: 'commentId', label: '评论ID', enabled: false, order: 2 },
  { key: 'postId', label: '所属帖子ID', enabled: false, order: 3 },
  { key: 'postTitle', label: '所属帖子标题', enabled: true, order: 4 },
  { key: 'authorId', label: '评论用户ID', enabled: false, order: 5 },
  { key: 'authorName', label: '评论用户昵称', enabled: true, order: 6 },
  { key: 'content', label: '评论内容', enabled: true, order: 7 },
  { key: 'likeCount', label: '点赞数', enabled: true, order: 8 },
  { key: 'replyCount', label: '回复数', enabled: false, order: 9 },
  { key: 'publishTime', label: '发布时间', enabled: true, order: 10 },
  { key: 'sourcePageUrl', label: '来源页面', enabled: false, order: 11 },
  { key: 'collectedAt', label: '采集时间', enabled: true, order: 12 }
];
