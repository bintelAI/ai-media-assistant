export default defineContentScript({
  matches: ['*://pgy.xiaohongshu.com/*'],
  runAt: 'document_start',
  world: 'MAIN',

  main() {
    let booted = false;

    const boot = () => {
      if (booted) return;
      booted = true;

      console.log('[智联AI] 蒲公英 MAIN world 拦截器已启动');

    const dataApis = [
      '/api/creator/',
      '/api/note/',
      '/api/user/',
      '/daren/',
      '/creator/',
      '/api/demand/',
      '/api/cooperate/',
      '/api/solar/invite/',
      '/api/solar/brand/',
      '/api/solar/user/',
      '/api/solar/cooperator/',
    ];

    function isDataApiUrl(url: string): boolean {
      return dataApis.some(api => url.includes(api));
    }

    function dispatchInterceptedData(url: string, data: any, method?: string, body?: any) {
      window.dispatchEvent(new CustomEvent('zl_pgy_api_intercepted', {
        detail: { url, data, method: method || 'GET', body }
      }));
    }

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
      (this as any)._url = typeof url === 'string' ? url : url.toString();
      (this as any)._method = method;
      return originalOpen.apply(this, [method, url, ...args] as any);
    };

    XMLHttpRequest.prototype.send = function(body?: any) {
      const url = (this as any)._url;
      const method = (this as any)._method;

      if (url && isDataApiUrl(url)) {
        const xhr = this;
        const originalOnReadyStateChange = xhr.onreadystatechange;

        xhr.onreadystatechange = function(ev: any) {
          if (xhr.readyState === 4 && xhr.status === 200) {
            try {
              const contentType = xhr.getResponseHeader('content-type') || '';
              if (contentType.includes('application/json')) {
                const data = JSON.parse(xhr.responseText);
                let parsedBody;
                if (body && typeof body === 'string') {
                  try { parsedBody = JSON.parse(body); } catch {}
                }
                dispatchInterceptedData(url, data, method, parsedBody);
              }
            } catch (e) {
              console.warn('[智联AI] 蒲公英解析XHR响应失败:', e);
            }
          }
          if (originalOnReadyStateChange) {
            originalOnReadyStateChange.call(xhr, ev);
          }
        };
      }

      return originalSend.apply(this, [body] as any);
    };

    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method || 'GET';
      const response = await originalFetch(input as any, init);

      if (url && isDataApiUrl(url)) {
        try {
          const cloned = response.clone();
          const data = await cloned.json();
          let parsedBody;
          if (init?.body && typeof init.body === 'string') {
            try { parsedBody = JSON.parse(init.body); } catch {}
          }
          dispatchInterceptedData(url, data, method, parsedBody);
        } catch (e) {
          console.warn('[智联AI] 蒲公英解析Fetch响应失败:', e);
        }
      }

      return response;
    };

      console.log('[智联AI] 蒲公英 MAIN world XHR+Fetch 拦截器已设置');
    };

    window.addEventListener('zl_pgy_dev_mode_enabled', boot, { once: true });
    if (document.documentElement.dataset.zlPgyDevMode === 'true') {
      boot();
    }
  }
});
