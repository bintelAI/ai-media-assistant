import { nanoid } from 'nanoid';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(prefix?: string): string {
  const id = nanoid(12);
  return prefix ? `${prefix}_${id}` : id;
}

export function formatDate(date: string | Date | undefined, formatStr = 'yyyy-MM-dd HH:mm:ss'): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, formatStr);
  } catch {
    return '';
  }
}

export function parseChineseNumber(text: string): number | undefined {
  if (!text) return undefined;
  
  text = text.trim();
  
  if (text.includes('万')) {
    const num = parseFloat(text.replace('万', ''));
    return num * 10000;
  }
  
  if (text.includes('亿')) {
    const num = parseFloat(text.replace('亿', ''));
    return num * 100000000;
  }
  
  const parsed = parseInt(text.replace(/[^\d]/g, ''), 10);
  return isNaN(parsed) ? undefined : parsed;
}

export function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null) return '';
  
  if (num >= 100000000) {
    return (num / 100000000).toFixed(1) + '亿';
  }
  
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  
  return num.toLocaleString();
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}

export function extractPostIdFromUrl(url: string, platform: string): string | null {
  try {
    const urlObj = new URL(url);
    
    switch (platform) {
      case 'xhs': {
        const match = urlObj.pathname.match(/\/explore\/([\w]+)/);
        return match ? match[1] : null;
      }
      case 'dy': {
        const match = urlObj.pathname.match(/\/video\/(\d+)/);
        return match ? match[1] : null;
      }
      case 'ks': {
        const match = urlObj.pathname.match(/\/short-video\/([\w]+)/);
        return match ? match[1] : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function extractAuthorIdFromUrl(url: string, platform: string): string | null {
  try {
    const urlObj = new URL(url);
    
    switch (platform) {
      case 'xhs': {
        const match = urlObj.pathname.match(/\/user\/profile\/([\w]+)/);
        return match ? match[1] : null;
      }
      case 'dy': {
        const match = urlObj.pathname.match(/\/user\/([\w]+)/);
        return match ? match[1] : null;
      }
      case 'ks': {
        const match = urlObj.pathname.match(/\/profile\/([\w]+)/);
        return match ? match[1] : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
