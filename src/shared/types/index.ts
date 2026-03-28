export type Platform = 'xhs' | 'douyin' | 'kuaishou' | 'xingtu' | 'pgy' | 'tiktok';

export type PostType = 'video' | 'image' | 'mixed' | 'text';

export type MediaType = 'image' | 'video';

export type TaskType =
  | 'collect_post'
  | 'collect_author'
  | 'collect_comments'
  | 'export_data'
  | 'download_media';

export type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'canceled';

export type PageType =
  | 'post_detail'
  | 'author_profile'
  | 'comments_page'
  | 'feed_list'
  | 'search_result'
  | 'unknown';

export type ExportFormat = 'csv' | 'excel' | 'json';

export type ExportScope = 'all' | 'filtered' | 'selected';

export type ExportTarget = 'posts' | 'authors' | 'comments' | 'media';
