export default defineContentScript({
  matches: ['*://www.xiaohongshu.com/*'],
  runAt: 'document_start',
  world: 'MAIN',

  main() {
    console.log('[智联AI] 小红书 MAIN world 脚本已加载');

    /**
     * 等待 _smzsRequest 函数可用
     * @param timeout 超时时间（毫秒）
     * @returns Promise<any> 返回 _smzsRequest 函数
     */
    const waitForSmzsRequest = (timeout: number = 10000): Promise<any> => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const check = () => {
          const smzsRequest = (window as any)._smzsRequest;
          if (smzsRequest) {
            console.log('[智联AI] MAIN world: 找到 _smzsRequest');
            console.log('[智联AI] MAIN world: _smzsRequest 类型:', typeof smzsRequest);
            console.log('[智联AI] MAIN world: _smzsRequest 方法:', Object.keys(smzsRequest));
            resolve(smzsRequest);
            return;
          }
          
          if (Date.now() - startTime > timeout) {
            console.error('[智联AI] MAIN world: 等待 _smzsRequest 超时');
            reject(new Error('等待 _smzsRequest 超时，请刷新页面'));
            return;
          }
          
          setTimeout(check, 100);
        };
        check();
      });
    };

    /**
     * 将参数对象转换为查询字符串
     * @param params 参数对象
     * @returns 查询字符串
     */
    const buildQueryString = (params: Record<string, any> | undefined): string => {
      if (!params || Object.keys(params).length === 0) {
        return '';
      }
      
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
      
      const queryString = searchParams.toString();
      return queryString ? `?${queryString}` : '';
    };

    /**
     * 使用 _smzsRequest 发送请求
     * @param smzsRequest _smzsRequest 函数
     * @param config 请求配置
     * @returns Promise<any> 返回响应数据
     */
    const sendRequest = (smzsRequest: any, config: {
      url: string;
      method?: string;
      params?: Record<string, any>;
      data?: any;
    }): Promise<any> => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('请求超时'));
        }, 30000);

        try {
          const method = (config.method || 'GET').toUpperCase();
          
          // 对于 GET 请求，将参数添加到 URL 中
          let fullUrl = config.url;
          if (method === 'GET' && config.params) {
            fullUrl = config.url + buildQueryString(config.params);
          }
          
          console.log('[智联AI] MAIN world: 调用 _smzsRequest, method:', method, 'url:', fullUrl);
          if (method === 'GET') {
            console.log('[智联AI] MAIN world: params:', config.params);
          } else {
            console.log('[智联AI] MAIN world: data:', config.data);
          }
          
          if (method === 'GET') {
            if (typeof smzsRequest.get === 'function') {
              // 使用回调风格，参数已经添加到 URL 中
              smzsRequest.get(fullUrl, undefined, {
                success: (response: any) => {
                  clearTimeout(timeout);
                  console.log('[智联AI] MAIN world: GET 请求成功', response);
                  resolve(response);
                },
                fail: (error: any) => {
                  clearTimeout(timeout);
                  console.error('[智联AI] MAIN world: GET 请求失败', error);
                  reject(new Error(error?.message || '请求失败'));
                }
              });
            } else {
              // 可能是 Promise 风格
              smzsRequest.get(fullUrl).then((response: any) => {
                clearTimeout(timeout);
                console.log('[智联AI] MAIN world: GET 请求成功 (Promise)', response);
                resolve(response);
              }).catch((error: any) => {
                clearTimeout(timeout);
                console.error('[智联AI] MAIN world: GET 请求失败 (Promise)', error);
                reject(new Error(error?.message || '请求失败'));
              });
            }
          } else if (method === 'POST') {
            if (typeof smzsRequest.post === 'function') {
              smzsRequest.post(fullUrl, config.data || config.params, {
                success: (response: any) => {
                  clearTimeout(timeout);
                  console.log('[智联AI] MAIN world: POST 请求成功', response);
                  resolve(response);
                },
                fail: (error: any) => {
                  clearTimeout(timeout);
                  console.error('[智联AI] MAIN world: POST 请求失败', error);
                  reject(new Error(error?.message || '请求失败'));
                }
              });
            } else {
              smzsRequest.post(fullUrl, config.data || config.params).then((response: any) => {
                clearTimeout(timeout);
                console.log('[智联AI] MAIN world: POST 请求成功 (Promise)', response);
                resolve(response);
              }).catch((error: any) => {
                clearTimeout(timeout);
                console.error('[智联AI] MAIN world: POST 请求失败 (Promise)', error);
                reject(new Error(error?.message || '请求失败'));
              });
            }
          } else {
            reject(new Error('不支持的请求方法: ' + method));
          }
        } catch (error) {
          clearTimeout(timeout);
          console.error('[智联AI] MAIN world: 调用 _smzsRequest 异常', error);
          reject(error);
        }
      });
    };

    window.addEventListener('message', async (event) => {
      if (event.data?.type !== 'zl_xhs_api_request') {
        return;
      }

      const { requestId, path, params, method, source } = event.data;

      if (source === 'main') {
        return;
      }

      console.log('[智联AI] MAIN world 收到消息:', event.data);

      try {
        const smzsRequest = await waitForSmzsRequest();

        const fullPath = path.startsWith('/') ? path : '/' + path;

        const config = {
          url: fullPath,
          method: method || 'GET',
          params: method === 'GET' ? params : undefined,
          data: method === 'POST' ? params : undefined
        };

        console.log('[智联AI] MAIN world 准备调用 _smzsRequest, config:', config);

        const response = await sendRequest(smzsRequest, config);

        window.postMessage({
          type: 'zl_xhs_api_response',
          requestId,
          source: 'main',
          response
        }, '*');
      } catch (error) {
        console.error('[智联AI] MAIN world 请求异常:', error);
        window.postMessage({
          type: 'zl_xhs_api_error',
          requestId,
          source: 'main',
          error: error instanceof Error ? error.message : '请求失败'
        }, '*');
      }
    });

  }
});
