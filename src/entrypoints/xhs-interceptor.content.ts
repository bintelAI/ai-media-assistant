
export default defineContentScript({
  matches: ['*://www.xiaohongshu.com/*'],
  runAt: 'document_start',
  world: 'MAIN', // 这个脚本专门运行在 MAIN world 来拦截网络请求

  main() {
    console.log('[智联AI] 小红书 MAIN world 拦截器已启动');

    const dataApis = [
      '/api/sns/web/v1/homefeed',
      '/api/sns/web/v1/search/notes',
      '/api/sns/web/v1/user_posted',
      '/api/sns/web/v2/note/',
      '/api/sns/web/v1/note/',
      '/api/sns/web/v2/user/',
      '/api/sns/web/v1/user/',
      '/api/sns/web/v2/comment/page',
      '/api/sns/web/v1/feed'
    ];

    function isDataApiUrl(url: string): boolean {
      return dataApis.some(api => url.includes(api));
    }

    function dispatchInterceptedData(url: string, data: any) {
      // 通过 CustomEvent 将数据发送到 ISOLATED world
      window.dispatchEvent(new CustomEvent('zl_xhs_api_intercepted', {
        detail: { url, data }
      }));
    }

    // --- 拦截 XHR ---
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
      (this as any)._url = typeof url === 'string' ? url : url.toString();
      return originalOpen.apply(this, [method, url, ...args] as any);
    };

    XMLHttpRequest.prototype.send = function(body?: any) {
      const url = (this as any)._url;
      if (url && isDataApiUrl(url)) {
        const xhr = this;
        const originalOnReadyStateChange = xhr.onreadystatechange;
        xhr.onreadystatechange = function(ev: any) {
          if (xhr.readyState === 4 && xhr.status === 200) {
            try {
              const contentType = xhr.getResponseHeader('content-type') || '';
              if (contentType.includes('application/json')) {
                const data = JSON.parse(xhr.responseText);
                dispatchInterceptedData(url, data);
              }
            } catch (e) {
              // 解析失败忽略
            }
          }
          if (originalOnReadyStateChange) {
            originalOnReadyStateChange.call(xhr, ev);
          }
        };
      }
      return originalSend.apply(this, [body] as any);
    };

    // --- 拦截 Fetch ---
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const response = await originalFetch(input as any, init);
      
      if (url && isDataApiUrl(url)) {
        try {
          const cloned = response.clone();
          const data = await cloned.json();
          dispatchInterceptedData(url, data);
        } catch (e) {
          // 解析失败忽略
        }
      }
      return response;
    };
  }
});
