import { create } from 'zustand';
import type { ExportTarget } from '../types';

type PageType = 'overview' | 'data' | 'tasks' | 'downloads' | 'settings' | 'batchCollect';
type DataTabType = 'posts' | 'authors' | 'comments' | 'media';

interface UIState {
  currentPage: PageType;
  currentDataTab: DataTabType;
  exportModalOpen: boolean;
  exportTarget: ExportTarget | null;
  detailDrawerOpen: boolean;
  detailType: 'post' | 'author' | 'comment' | null;
  detailId: string | null;
  taskDetailOpen: boolean;
  taskDetailId: string | null;
  toastMessage: string;
  toastType: 'success' | 'error' | 'info';
  
  setCurrentPage: (page: PageType) => void;
  setCurrentDataTab: (tab: DataTabType) => void;
  openExportModal: (target: ExportTarget) => void;
  closeExportModal: () => void;
  openDetailDrawer: (type: 'post' | 'author' | 'comment', id: string) => void;
  closeDetailDrawer: () => void;
  openTaskDetailDrawer: (id: string) => void;
  closeTaskDetailDrawer: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  currentPage: 'overview',
  currentDataTab: 'posts',
  exportModalOpen: false,
  exportTarget: null,
  detailDrawerOpen: false,
  detailType: null,
  detailId: null,
  taskDetailOpen: false,
  taskDetailId: null,
  toastMessage: '',
  toastType: 'info',
  
  setCurrentPage: (page) => {
    set({ currentPage: page });
  },
  
  setCurrentDataTab: (tab) => {
    set({ currentDataTab: tab });
  },
  
  openExportModal: (target) => {
    set({ exportModalOpen: true, exportTarget: target });
  },
  
  closeExportModal: () => {
    set({ exportModalOpen: false, exportTarget: null });
  },
  
  openDetailDrawer: (type, id) => {
    set({ detailDrawerOpen: true, detailType: type, detailId: id });
  },
  
  closeDetailDrawer: () => {
    set({ detailDrawerOpen: false, detailType: null, detailId: null });
  },
  
  openTaskDetailDrawer: (id) => {
    set({ taskDetailOpen: true, taskDetailId: id });
  },
  
  closeTaskDetailDrawer: () => {
    set({ taskDetailOpen: false, taskDetailId: null });
  },
  
  showToast: (message, type = 'info') => {
    set({ toastMessage: message, toastType: type });
  },
  
  clearToast: () => {
    set({ toastMessage: '', toastType: 'info' });
  }
}));
