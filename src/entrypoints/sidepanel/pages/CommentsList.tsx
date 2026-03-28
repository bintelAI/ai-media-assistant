import { useEffect, useState } from 'react';
import { useCommentsStore, useUIStore } from '@/shared/store';
import { Search, Download, Trash2, CheckSquare, Square } from 'lucide-react';
import { formatDate, truncate, cn } from '@/shared/utils/helpers';
import type { CommentEntity } from '@/shared/types/entities';
import type { Platform } from '@/shared/types';

const platformOptions = [
  { value: '', label: '全部平台' },
  { value: 'xhs', label: '小红书' },
  { value: 'dy', label: '抖音' },
  { value: 'ks', label: '快手' }
];

export default function CommentsList() {
  const { 
    comments, 
    selectedIds, 
    loading, 
    fetchComments, 
    toggleSelect, 
    selectAll, 
    clearSelection, 
    deleteSelected 
  } = useCommentsStore();
  const { openExportModal, openDetailDrawer } = useUIStore();
  
  const [searchKeyword, setSearchKeyword] = useState('');

  useEffect(() => {
    fetchComments();
  }, []);

  const handleSearch = () => {
    fetchComments({ keyword: searchKeyword });
  };

  const handleExport = () => {
    openExportModal('comments');
  };

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;
    if (confirm(`确定要删除选中的 ${selectedIds.length} 条数据吗？`)) {
      await deleteSelected();
    }
  };

  const isAllSelected = comments.length > 0 && selectedIds.length === comments.length;

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-gray-200 p-3 space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索评论内容..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={isAllSelected ? clearSelection : selectAll}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-primary-500" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              {isAllSelected ? '取消全选' : '全选'}
            </button>
            <span className="text-sm text-gray-400">
              已选 {selectedIds.length} 条
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1 px-3 py-1 bg-primary-500 text-white rounded-md text-sm hover:bg-primary-600"
            >
              <Download className="w-4 h-4" />
              导出
            </button>
            {selectedIds.length > 0 && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 px-3 py-1 bg-red-500 text-white rounded-md text-sm hover:bg-red-600"
              >
                <Trash2 className="w-4 h-4" />
                删除
              </button>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">加载中...</div>
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p>暂无数据</p>
            <p className="text-sm mt-1">请在支持的平台页面采集评论</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {comments.map((comment) => (
              <CommentRow 
                key={comment.id} 
                comment={comment} 
                selected={selectedIds.includes(comment.id)}
                onSelect={() => toggleSelect(comment.id)}
                onClick={() => openDetailDrawer('comment', comment.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CommentRow({ 
  comment, 
  selected, 
  onSelect, 
  onClick 
}: { 
  comment: CommentEntity; 
  selected: boolean; 
  onSelect: () => void;
  onClick: () => void;
}) {
  const platformLabel: Record<Platform, string> = {
    xhs: '小红书',
    dy: '抖音',
    ks: '快手',
    tiktok: 'TikTok'
  };

  return (
    <div 
      className="flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer"
      onClick={onClick}
    >
      <div 
        className="pt-1"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {selected ? (
          <CheckSquare className="w-4 h-4 text-primary-500" />
        ) : (
          <Square className="w-4 h-4 text-gray-300" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-xs px-1.5 py-0.5 rounded',
            comment.platform === 'xhs' ? 'bg-red-100 text-red-600' :
            comment.platform === 'dy' ? 'bg-gray-100 text-gray-600' :
            comment.platform === 'ks' ? 'bg-orange-100 text-orange-600' :
            'bg-gray-100 text-gray-600'
          )}>
            {platformLabel[comment.platform]}
          </span>
          <span className="text-xs text-gray-400">{comment.authorName}</span>
        </div>
        
        <p className="text-sm mt-1 line-clamp-2">
          {truncate(comment.content, 80)}
        </p>
        
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
          {comment.likeCount !== undefined && (
            <span>👍 {comment.likeCount}</span>
          )}
          {comment.replyCount !== undefined && (
            <span>💬 {comment.replyCount}</span>
          )}
          <span>{formatDate(comment.collectedAt, 'yyyy-MM-dd')}</span>
        </div>
      </div>
    </div>
  );
}
