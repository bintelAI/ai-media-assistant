import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChromeStorage } from '../utils/storage';
import { DEFAULT_SETTINGS } from '../utils/constants';
import type { ExportFormat } from '../types';

interface Settings {
  defaultExportFormat: ExportFormat;
  autoDedupe: boolean;
  autoOpenSidePanel: boolean;
  taskConcurrency: number;
  retryCount: number;
  downloadNamingRule: string;
}

interface SettingsState extends Settings {
  updateSettings: (settings: Partial<Settings>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      
      updateSettings: (settings) => {
        set(settings);
      },
      
      resetSettings: () => {
        set(DEFAULT_SETTINGS);
      }
    }),
    {
      name: 'zhi-lian-cai-ji-settings',
      storage: {
        getItem: async (name) => {
          const value = await ChromeStorage.getItem(name);
          return value ?? null;
        },
        setItem: async (name, value) => {
          await ChromeStorage.setItem(name, value);
        },
        removeItem: async (name) => {
          await ChromeStorage.removeItem(name);
        }
      }
    }
  )
);
