(function() {
  if (window.__zl_dy_interceptor) return;
  window.__zl_dy_interceptor = true;
  var DY_APIS = [
    '/aweme/v1/web/aweme/detail/',
    '/aweme/v1/web/aweme/post/',
    '/aweme/v1/web/user/profile/',
    '/aweme/v1/web/search/item/',
    '/aweme/v1/web/search/single/',
    '/aweme/v1/web/general/search/single/',
    '/aweme/v1/web/general/search/stream/',
    '/aweme/v1/web/feed/',
    '/aweme/v1/web/homepage/',
    '/v1/web/user/posts/',
    '/v1/web/familiar/feed/',
    '/live/promotions/page/'
  ];
  function isDYApiUrl(url) { return DY_APIS.some(function(api) { return url.indexOf(api) !== -1; }); }
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
          if (ct.indexOf('application/json') !== -1) {
            window.postMessage({ type: 'zl_dy_api_response', url: xhr.__zl_url, method: xhr.__zl_method || 'GET', data: JSON.parse(xhr.responseText) }, '*');
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
          try {
            var data = JSON.parse(text);
            window.postMessage({ type: 'zl_dy_api_response', url: url, method: (init && init.method) || 'GET', data: data }, '*');
          } catch(e) {}
        }).catch(function() {});
      }
      return response;
    });
  };
})();