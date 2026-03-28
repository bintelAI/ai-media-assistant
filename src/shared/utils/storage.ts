export const ChromeStorage = {
  async getItem<T = unknown>(name: string): Promise<T | null> {
    try {
      const result = await chrome.storage.local.get(name);
      return result[name] ?? null;
    } catch {
      return null;
    }
  },

  async setItem<T>(name: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [name]: value });
  },

  async removeItem(name: string): Promise<void> {
    await chrome.storage.local.remove(name);
  },

  async clear(): Promise<void> {
    await chrome.storage.local.clear();
  },

  async getAll(): Promise<Record<string, unknown>> {
    return await chrome.storage.local.get(null);
  }
};

export const ChromeSyncStorage = {
  async getItem<T = unknown>(name: string): Promise<T | null> {
    try {
      const result = await chrome.storage.sync.get(name);
      return result[name] ?? null;
    } catch {
      return null;
    }
  },

  async setItem<T>(name: string, value: T): Promise<void> {
    await chrome.storage.sync.set({ [name]: value });
  },

  async removeItem(name: string): Promise<void> {
    await chrome.storage.sync.remove(name);
  },

  async clear(): Promise<void> {
    await chrome.storage.sync.clear();
  }
};
