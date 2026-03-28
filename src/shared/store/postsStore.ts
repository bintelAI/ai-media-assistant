import { create } from 'zustand';
import type { PostEntity } from '../types/entities';
import { queryPosts, countPosts, deletePosts, clearPosts } from '../db/posts';
import type { PostQueryOptions } from '../db/posts';

interface PostsState {
  posts: PostEntity[];
  total: number;
  selectedIds: string[];
  loading: boolean;
  filters: PostQueryOptions;
  
  fetchPosts: (options?: PostQueryOptions) => Promise<void>;
  setSelectedIds: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  deleteSelected: () => Promise<void>;
  setFilters: (filters: Partial<PostQueryOptions>) => void;
  getExportData: (scope: 'all' | 'filtered' | 'selected') => Promise<PostEntity[]>;
}

export const usePostsStore = create<PostsState>((set, get) => ({
  posts: [],
  total: 0,
  selectedIds: [],
  loading: false,
  filters: {},
  
  fetchPosts: async (options?: PostQueryOptions) => {
    set({ loading: true });
    try {
      const filters = { ...get().filters, ...options };
      const [posts, total] = await Promise.all([
        queryPosts(filters),
        countPosts(filters)
      ]);
      set({ posts, total, filters, loading: false });
    } catch (error) {
      console.error('Failed to fetch posts:', error);
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
    const { posts } = get();
    set({ selectedIds: posts.map(p => p.id) });
  },
  
  clearSelection: () => {
    set({ selectedIds: [] });
  },
  
  deleteSelected: async () => {
    const { selectedIds, fetchPosts, filters } = get();
    if (selectedIds.length === 0) return;
    
    await deletePosts(selectedIds);
    set({ selectedIds: [] });
    await fetchPosts(filters);
  },
  
  setFilters: (filters: Partial<PostQueryOptions>) => {
    const currentFilters = get().filters;
    set({ filters: { ...currentFilters, ...filters } });
  },
  
  getExportData: async (scope: 'all' | 'filtered' | 'selected') => {
    const { posts, selectedIds, filters } = get();
    
    switch (scope) {
      case 'all':
        return queryPosts({});
      case 'filtered':
        return queryPosts(filters);
      case 'selected':
        return posts.filter(p => selectedIds.includes(p.id));
      default:
        return [];
    }
  }
}));
