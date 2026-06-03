(function() {
  if (window.__zl_dy_interceptor) return;
  window.__zl_dy_interceptor = true;
  var EXTRA_DY_APIS = [
    '/v1/web/user/posts/',
    '/v1/web/familiar/feed/',
    '/aweme/v2/web/module/feed/',
    '/aweme/v1/web/multi/aweme/detail/',
    '/live/promotions/page/'
  ];
  function normalizeDouyinUrl(url) {
    return String(url || '').replace(/^https:\/\/www-[^.]+\.douyin\.com/, 'https://www.douyin.com');
  }
  function isDYApiUrl(url) {
    var normalized = normalizeDouyinUrl(url);
    return normalized.indexOf('https://www.douyin.com/aweme/v1/web/') === 0 ||
      EXTRA_DY_APIS.some(function(api) { return normalized.indexOf(api) !== -1; });
  }
  function parseDYResponseText(url, text) {
    try {
      return JSON.parse(text);
    } catch(e) {}

    var normalized = normalizeDouyinUrl(url);
    if (normalized.indexOf('/aweme/v1/web/general/search/stream/') === -1) {
      return null;
    }

    var chunks = String(text || '')
      .split(/\r?\n/)
      .map(function(line) { return line.trim(); })
      .filter(Boolean);
    var flattened = [];
    var statusCode = 0;
    var statusMsg = '';

    chunks.forEach(function(line) {
      var jsonText = line;
      if (jsonText.indexOf('data:') === 0) {
        jsonText = jsonText.slice(5).trim();
      }
      if (!jsonText || jsonText === '[DONE]') return;

      try {
        var parsed = JSON.parse(jsonText);
        if (typeof parsed.status_code === 'number') statusCode = parsed.status_code;
        if (parsed.status_msg) statusMsg = parsed.status_msg;

        var data = parsed.data || parsed.aweme_list || parsed.items || [];
        if (Array.isArray(data)) {
          flattened = flattened.concat(data);
        } else if (data && typeof data === 'object') {
          flattened.push(data);
        }
      } catch(e) {}
    });

    if (flattened.length === 0) {
      return null;
    }

    return {
      status_code: statusCode,
      status_msg: statusMsg,
      data: flattened
    };
  }
  function postDYApiResponse(rawUrl, method, data, body) {
    window.postMessage({
      type: 'zl_dy_api_response',
      url: normalizeDouyinUrl(rawUrl),
      rawUrl: rawUrl,
      method: method || 'GET',
      body: body,
      data: data
    }, '*');
  }
  function waitForDYHttp(method, timeout) {
    return new Promise(function(resolve, reject) {
      var start = Date.now();
      var check = function() {
        var fn = method === 'POST' ? window._smzsHttpPost : window._smzsHttpGet;
        if (typeof fn === 'function') {
          resolve(fn);
          return;
        }
        if (Date.now() - start > timeout) {
          reject(new Error('抖音页面请求函数未就绪，请刷新抖音页面后重试'));
          return;
        }
        setTimeout(check, 120);
      };
      check();
    });
  }
  async function sendDYApiCall(config) {
    var method = String(config.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'POST') {
      throw new Error('不支持的抖音请求方法: ' + method);
    }

    var params = Object.assign({}, config.params || {});
    if (!params.aid) params.aid = 6383;
    if (!params.channel) params.channel = 'channel_pc_web';
    if (!params.device_platform) params.device_platform = 'webapp';

    var path = config.path || config.url || '';
    if (!path) throw new Error('抖音请求路径为空');
    if (path.indexOf('https://www.douyin.com') === 0) {
      path = path.replace('https://www.douyin.com', '');
    }

    var requestFn = await waitForDYHttp(method, config.timeout || 12000);
    var response = await requestFn(path, params, {});
    if (!response) {
      throw new Error('抖音 API 返回内容为空，可能已被平台限制');
    }

    var decision = response.whaleDecisionCustom;
    if (decision) {
      throw new Error(decision === 'black_no_login' ? '请先登录抖音账号后再试' : decision);
    }

    if (response.status_code) {
      throw new Error(response.status_msg || response.statusMsg || '抖音 API 请求失败');
    }

    return response;
  }
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'zl_dy_api_ping') {
      if (event.data.source === 'main') return;
      var hasGet = typeof window._smzsHttpGet === 'function';
      var hasPost = typeof window._smzsHttpPost === 'function';
      window.postMessage({
        type: 'zl_dy_api_ping_response',
        requestId: event.data.requestId,
        source: 'main',
        href: location.href,
        readyState: document.readyState,
        hasGet: hasGet,
        hasPost: hasPost,
        hasBridge: hasGet || hasPost
      }, '*');
      return;
    }

    if (event.data && event.data.type === 'zl_dy_api_request') {
      if (event.data.source === 'main') return;
      var requestId = event.data.requestId;
      sendDYApiCall(event.data).then(function(response) {
        window.postMessage({
          type: 'zl_dy_api_call_response',
          requestId: requestId,
          source: 'main',
          response: response
        }, '*');
      }).catch(function(error) {
        window.postMessage({
          type: 'zl_dy_api_call_error',
          requestId: requestId,
          source: 'main',
          error: error && error.message ? error.message : '抖音 API 请求失败'
        }, '*');
      });
    }
  });
  var _origOpen = XMLHttpRequest.prototype.open;
  var _origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this.__zl_url = typeof url === 'string' ? url : (url && url.toString ? url.toString() : '');
    this.__zl_method = method;
    return _origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body) {
    var xhr = this;
    var origOnload = xhr.onload;
    xhr.onload = function() {
      try {
        if (xhr.readyState === 4 && xhr.status === 200 && xhr.__zl_url && isDYApiUrl(xhr.__zl_url)) {
          var ct = xhr.getResponseHeader('content-type') || '';
          if (ct.indexOf('application/json') !== -1 || xhr.__zl_url.indexOf('/general/search/stream/') !== -1) {
            var data = parseDYResponseText(xhr.__zl_url, xhr.responseText);
            if (data) {
              postDYApiResponse(xhr.__zl_url, xhr.__zl_method || 'GET', data, body);
            }
          }
        }
      } catch(e) {}
      if (origOnload) origOnload.call(xhr);
    };
    return _origSend.apply(xhr, arguments);
  };
  var _origFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
    return _origFetch.apply(this, arguments).then(function(response) {
      if (response.ok && url && isDYApiUrl(url)) {
        var cloned = response.clone();
        cloned.text().then(function(text) {
          var data = parseDYResponseText(url, text);
          if (data) {
            postDYApiResponse(url, (init && init.method) || 'GET', data, init && init.body);
          }
        }).catch(function() {});
      }
      return response;
    });
  };
})();
