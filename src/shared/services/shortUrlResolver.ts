import { parseUrl, cleanUrl } from '@/shared/utils/urlParser';
import type { ParsedUrl } from '@/shared/types/batchCollect';

/**
 * 短链解析结果
 */
export interface ShortUrlResolveResult {
  success: boolean;
  originalUrl: string;
  resolvedUrl?: string;
  parsed?: ParsedUrl;
  error?: string;
}

/**
 * 解析小红书短链
 * 通过发送 HEAD 请求获取最终跳转的长链接
 * @param shortUrl 短链接
 * @returns 解析结果
 */
export async function resolveXhsShortUrl(shortUrl: string): Promise<ShortUrlResolveResult> {
  try {
    const cleanedUrl = cleanUrl(shortUrl);
    console.log(`[ShortUrlResolver] 开始解析短链: ${cleanedUrl}`);

    const response = await fetch(cleanedUrl, {
      method: 'HEAD',
      redirect: 'follow',
      credentials: 'include'
    });

    const resolvedUrl = response.url;

    if (!resolvedUrl || resolvedUrl === cleanedUrl) {
      return {
        success: false,
        originalUrl: cleanedUrl,
        error: '无法获取跳转后的URL'
      };
    }

    console.log(`[ShortUrlResolver] 短链解析成功: ${cleanedUrl} -> ${resolvedUrl}`);

    const parsed = parseUrl(resolvedUrl);

    if (!parsed) {
      return {
        success: false,
        originalUrl: cleanedUrl,
        resolvedUrl,
        error: '解析后的URL不是有效的小红书链接'
      };
    }

    return {
      success: true,
      originalUrl: cleanedUrl,
      resolvedUrl,
      parsed
    };
  } catch (error) {
    console.error(`[ShortUrlResolver] 解析短链失败:`, error);
    return {
      success: false,
      originalUrl: cleanUrl(shortUrl),
      error: error instanceof Error ? error.message : '解析失败'
    };
  }
}

/**
 * 批量解析小红书短链
 * @param urls URL列表（包含短链和长链）
 * @param onProgress 进度回调
 * @returns 解析结果列表
 */
export async function resolveShortUrls(
  urls: string[],
  onProgress?: (current: number, total: number) => void
): Promise<ShortUrlResolveResult[]> {
  const results: ShortUrlResolveResult[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = cleanUrl(urls[i]);

    if (!url) {
      continue;
    }

    onProgress?.(i + 1, urls.length);

    const parsed = parseUrl(url);

    if (parsed && parsed.isShortUrl) {
      const result = await resolveXhsShortUrl(url);
      results.push(result);
      await delay(200);
    } else if (parsed) {
      results.push({
        success: true,
        originalUrl: url,
        resolvedUrl: url,
        parsed
      });
    } else {
      results.push({
        success: false,
        originalUrl: url,
        error: '无效的URL格式'
      });
    }
  }

  return results;
}

/**
 * 延迟函数
 * @param ms 毫秒数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
