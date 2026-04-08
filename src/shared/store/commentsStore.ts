import { create } from 'zustand';
import type { CommentEntity, PostEntity } from '../types/entities';
import { queryComments, countComments, deleteComments, clearComments, getPostsWithComments } from '../db/comments';
import { queryPosts } from '../db/posts';
import type { CommentQueryOptions } from '../db/comments';

interface PostWithComments {
  post: PostEntity | null;
  postId: string;
  commentCount: number;
}

interface CommentsState {
  comments: CommentEntity[];
  total: number;
  selectedIds: string[];
  loading: boolean;
  filters: CommentQueryOptions;
  
  postsWithComments: PostWithComments[];
  currentPostId: string | null;
  postsLoading: boolean;
  
  fetchComments: (options?: CommentQueryOptions) => Promise<void>;
  setSelectedIds: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  deleteSelected: () => Promise<void>;
  setFilters: (filters: Partial<CommentQueryOptions>) => void;
  getExportData: (scope: 'all' | 'filtered' | 'selected') => Promise<CommentEntity[]>;
  
  fetchPostsWithComments: () => Promise<void>;
  setCurrentPostId: (postId: string | null) => void;
  goBackToList: () => void;
}

export const useCommentsStore = create<CommentsState>((set, get) => ({
  comments: [],
  total: 0,
  selectedIds: [],
  loading: false,
  filters: {},
  
  postsWithComments: [],
  currentPostId: null,
  postsLoading: false,
  
  fetchComments: async (options?: CommentQueryOptions) => {
    set({ loading: true });
    try {
      const filters = { ...get().filters, ...options };
      const [comments, total] = await Promise.all([
        queryComments(filters),
        countComments(filters)
      ]);
      set({ comments, total, filters, loading: false });
    } catch (error) {
      console.error('Failed to fetch comments:', error);
      set({ loading: false });
    }
  },
  
  setSelectedIds: (ids: string[]) => {
    set({ selectedIds: ids });
  },
  
  toggleSelect: (id: string) => {
    const { selectedIds } = get();
    const newSelectedIds = selectedIds.includes(id)
      ? selectedIds.filter(i => i !== id)
      : [...selectedIds, id];
    set({ selectedIds: newSelectedIds });
  },
  
  selectAll: () => {
    const { comments } = get();
    set({ selectedIds: comments.map(c => c.id) });
  },
  
  clearSelection: () => {
    set({ selectedIds: [] });
  },
  
  deleteSelected: async () => {
    const { selectedIds, fetchComments, filters, currentPostId } = get();
    if (selectedIds.length === 0) return;
    
    await deleteComments(selectedIds);
    set({ selectedIds: [] });
    
    if (currentPostId) {
      await fetchComments({ ...filters, postId: currentPostId });
    } else {
      await fetchComments(filters);
    }
    
    await get().fetchPostsWithComments();
  },
  
  setFilters: (filters: Partial<CommentQueryOptions>) => {
    const currentFilters = get().filters;
    set({ filters: { ...currentFilters, ...filters } });
  },
  
  getExportData: async (scope: 'all' | 'filtered' | 'selected') => {
    const { comments, selectedIds, filters } = get();
    
    switch (scope) {
      case 'all':
        return queryComments({});
      case 'filtered':
        return queryComments(filters);
      case 'selected':
        return comments.filter(c => selectedIds.includes(c.id));
      default:
        return [];
    }
  },
  
  fetchPostsWithComments: async () => {
    set({ postsLoading: true });
    try {
      const postCommentCounts = await getPostsWithComments();
      
      const postIds = Array.from(postCommentCounts.keys());
      const allPosts = await queryPosts({});
      
      const postsWithComments: PostWithComments[] = postIds.map(postId => {
        const post = allPosts.find(p => p.postId === postId) || null;
        return {
          post,
          postId,
          commentCount: postCommentCounts.get(postId) || 0
        };
      });
      
      postsWithComments.sort((a, b) => b.commentCount - a.commentCount);
      
      set({ postsWithComments, postsLoading: false });
    } catch (error) {
      console.error('Failed to fetch posts with comments:', error);
      set({ postsLoading: false });
    }
  },
  
  setCurrentPostId: (postId: string | null) => {
    set({ currentPostId: postId, selectedIds: [] });
    if (postId) {
      get().fetchComments({ postId });
    }
  },
  
  goBackToList: () => {
    set({ currentPostId: null, comments: [], selectedIds: [] });
    get().fetchPostsWithComments();
  }
}));
