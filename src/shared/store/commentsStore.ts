import { create } from 'zustand';
import type { CommentEntity } from '../types/entities';
import { queryComments, countComments, deleteComments, clearComments } from '../db/comments';
import type { CommentQueryOptions } from '../db/comments';

interface CommentsState {
  comments: CommentEntity[];
  total: number;
  selectedIds: string[];
  loading: boolean;
  filters: CommentQueryOptions;
  
  fetchComments: (options?: CommentQueryOptions) => Promise<void>;
  setSelectedIds: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  deleteSelected: () => Promise<void>;
  setFilters: (filters: Partial<CommentQueryOptions>) => void;
  getExportData: (scope: 'all' | 'filtered' | 'selected') => Promise<CommentEntity[]>;
}

export const useCommentsStore = create<CommentsState>((set, get) => ({
  comments: [],
  total: 0,
  selectedIds: [],
  loading: false,
  filters: {},
  
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
    const { selectedIds, fetchComments, filters } = get();
    if (selectedIds.length === 0) return;
    
    await deleteComments(selectedIds);
    set({ selectedIds: [] });
    await fetchComments(filters);
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
  }
}));
