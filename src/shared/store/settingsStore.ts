import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StorageValue } from 'zustand/middleware';
import { ChromeStorage } from '../utils/storage';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, type AppSettings } from '../utils/constants';

type Settings = AppSettings;

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
      name: SETTINGS_STORAGE_KEY,
      storage: {
        getItem: async (name) => {
          const value = await ChromeStorage.getItem<StorageValue<SettingsState>>(name);
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
