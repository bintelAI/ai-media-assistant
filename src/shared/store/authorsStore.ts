import { create } from 'zustand';
import type { AuthorEntity } from '../types/entities';
import { queryAuthors, countAuthors, deleteAuthors, clearAuthors } from '../db/authors';
import type { AuthorQueryOptions } from '../db/authors';

interface AuthorsState {
  authors: AuthorEntity[];
  total: number;
  selectedIds: string[];
  loading: boolean;
  filters: AuthorQueryOptions;
  
  fetchAuthors: (options?: AuthorQueryOptions) => Promise<void>;
  setSelectedIds: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  deleteSelected: () => Promise<void>;
  setFilters: (filters: Partial<AuthorQueryOptions>) => void;
  getExportData: (scope: 'all' | 'filtered' | 'selected') => Promise<AuthorEntity[]>;
}

export const useAuthorsStore = create<AuthorsState>((set, get) => ({
  authors: [],
  total: 0,
  selectedIds: [],
  loading: false,
  filters: {},
  
  fetchAuthors: async (options?: AuthorQueryOptions) => {
    set({ loading: true });
    try {
      const filters = { ...get().filters, ...options };
      const [authors, total] = await Promise.all([
        queryAuthors(filters),
        countAuthors(filters)
      ]);
      set({ authors, total, filters, loading: false });
    } catch (error) {
      console.error('Failed to fetch authors:', error);
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
    const { authors } = get();
    set({ selectedIds: authors.map(a => a.id) });
  },
  
  clearSelection: () => {
    set({ selectedIds: [] });
  },
  
  deleteSelected: async () => {
    const { selectedIds, fetchAuthors, filters } = get();
    if (selectedIds.length === 0) return;
    
    await deleteAuthors(selectedIds);
    set({ selectedIds: [] });
    await fetchAuthors(filters);
  },
  
  setFilters: (filters: Partial<AuthorQueryOptions>) => {
    const currentFilters = get().filters;
    set({ filters: { ...currentFilters, ...filters } });
  },
  
  getExportData: async (scope: 'all' | 'filtered' | 'selected') => {
    const { authors, selectedIds, filters } = get();
    
    switch (scope) {
      case 'all':
        return queryAuthors({});
      case 'filtered':
        return queryAuthors(filters);
      case 'selected':
        return authors.filter(a => selectedIds.includes(a.id));
      default:
        return [];
    }
  }
}));
