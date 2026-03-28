import { useEffect, useState } from 'react';
import { useUIStore } from '@/shared/store';
import { getPost, getAuthor, getComment } from '@/shared/db';
import { X, ExternalLink, Download, Trash2 } from 'lucide-react';
import { formatDate, formatNumber } from '@/shared/utils/helpers';
import type { PostEntity, AuthorEntity, CommentEntity } from '@/shared/types/entities';

export default function DetailDrawer() {
  const { detailType, detailId, closeDetailDrawer } = useUIStore();
  const [data, setData] = useState<PostEntity | AuthorEntity | CommentEntity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!detailType || !detailId) return;
      
      setLoading(true);
      try {
        let result;
        switch (detailType) {
          case 'post':
            result = await getPost(detailId);
            break;
          case 'author':
            result = await getAuthor(detailId);
            break;
          case 'comment':
            result = await getComment(detailId);
            break;
        }
        setData(result || null);
      } catch (error) {
        console.error('Failed to fetch detail:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [detailType, detailId]);

  if (!detailType || !detailId) return null;

  const title = detailType === 'post' ? '帖子详情' : 
                detailType === 'author' ? '作者详情' : '评论详情';

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
      <div className="bg-white w-[90%] max-w-md h-full flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium">{title}</h3>
          <button onClick={closeDetailDrawer} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-400">加载中...</div>
            </div>
          ) : !data ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-400">数据不存在</div>
            </div>
          ) : (
            <div className="space-y-4">
              {detailType === 'post' && <PostDetail data={data as PostEntity} />}
              {detailType === 'author' && <AuthorDetail data={data as AuthorEntity} />}
              {detailType === 'comment' && <CommentDetail data={data as CommentEntity} />}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-200">
          <button
            onClick={closeDetailDrawer}
            className="flex-1 py-2 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
          >
            关闭
          </button>
          {data && 'url' in data && (
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 flex-1 py-2 text-sm text-primary-500 bg-primary-50 rounded hover:bg-primary-100"
            >
              <ExternalLink className="w-4 h-4" />
              打开原链接
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function PostDetail({ data }: { data: PostEntity }) {
  const fields = [
    { label: '平台', value: data.platform },
    { label: '帖子ID', value: data.postId },
    { label: '类型', value: data.postType },
    { label: '标题', value: data.title },
    { label: '内容', value: data.content },
    { label: '链接', value: data.url, isLink: true },
    { label: '作者', value: data.authorName },
    { label: '作者ID', value: data.authorId },
    { label: '发布时间', value: formatDate(data.publishTime) },
    { label: '点赞数', value: formatNumber(data.likeCount) },
    { label: '评论数', value: formatNumber(data.commentCount) },
    { label: '收藏数', value: formatNumber(data.collectCount) },
    { label: '分享数', value: formatNumber(data.shareCount) },
    { label: '播放数', value: formatNumber(data.viewCount) },
    { label: '采集时间', value: formatDate(data.collectedAt) },
    { label: '备注', value: data.note }
  ];

  return (
    <>
      {data.coverUrl && (
        <img src={data.coverUrl} alt="" className="w-full rounded-lg" />
      )}
      
      <div className="space-y-3">
        {fields.filter(f => f.value !== undefined && f.value !== null && f.value !== '').map(field => (
          <div key={field.label}>
            <label className="block text-xs text-gray-400 mb-0.5">{field.label}</label>
            {field.isLink ? (
              <a 
                href={field.value as string} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary-500 hover:underline break-all"
              >
                {field.value as string}
              </a>
            ) : (
              <p className="text-sm break-all">{field.value as string}</p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function AuthorDetail({ data }: { data: AuthorEntity }) {
  const fields = [
    { label: '平台', value: data.platform },
    { label: '作者ID', value: data.authorId },
    { label: '昵称', value: data.name },
    { label: '简介', value: data.bio },
    { label: '主页链接', value: data.profileUrl, isLink: true },
    { label: '粉丝数', value: formatNumber(data.fansCount) },
    { label: '关注数', value: formatNumber(data.followCount) },
    { label: '获赞数', value: formatNumber(data.likedCount) },
    { label: '作品数', value: formatNumber(data.workCount) },
    { label: '地区', value: data.location },
    { label: '认证', value: data.verified ? '是' : '否' },
    { label: '认证说明', value: data.verifiedDesc },
    { label: '联系方式', value: data.contactInfo },
    { label: '采集时间', value: formatDate(data.collectedAt) },
    { label: '备注', value: data.note }
  ];

  return (
    <>
      <div className="flex items-center gap-3">
        {data.avatar && (
          <img src={data.avatar} alt="" className="w-16 h-16 rounded-full" />
        )}
        <div>
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-gray-400">{data.platform}</p>
        </div>
      </div>
      
      <div className="space-y-3">
        {fields.filter(f => f.value !== undefined && f.value !== null && f.value !== '').map(field => (
          <div key={field.label}>
            <label className="block text-xs text-gray-400 mb-0.5">{field.label}</label>
            {field.isLink ? (
              <a 
                href={field.value as string} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary-500 hover:underline break-all"
              >
                {field.value as string}
              </a>
            ) : (
              <p className="text-sm break-all">{field.value as string}</p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function CommentDetail({ data }: { data: CommentEntity }) {
  const fields = [
    { label: '平台', value: data.platform },
    { label: '评论ID', value: data.commentId },
    { label: '评论用户', value: data.authorName },
    { label: '内容', value: data.content },
    { label: '所属帖子', value: data.postTitle },
    { label: '帖子ID', value: data.postId },
    { label: '点赞数', value: formatNumber(data.likeCount) },
    { label: '回复数', value: formatNumber(data.replyCount) },
    { label: '发布时间', value: formatDate(data.publishTime) },
    { label: '采集时间', value: formatDate(data.collectedAt) }
  ];

  return (
    <div className="space-y-3">
      {fields.filter(f => f.value !== undefined && f.value !== null && f.value !== '').map(field => (
        <div key={field.label}>
          <label className="block text-xs text-gray-400 mb-0.5">{field.label}</label>
          <p className="text-sm break-all">{field.value as string}</p>
        </div>
      ))}
    </div>
  );
}
