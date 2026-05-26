export default defineContentScript({
  matches: ['*://pgy.xiaohongshu.com/*'],
  runAt: 'document_start',
  world: 'MAIN',

  main() {
    console.log('[智联AI] 蒲公英 MAIN world API 脚本已加载');

    const PGY_BASE_URL = 'https://pgy.xiaohongshu.com';
    const CUSTOM_BASE64_CHARS = 'A4NjFqYu5wPHsO0XTdDgMa2r1ZQocVte9UJBvk6/7=yRnhISGKblCWi+LpfE8xzm3';

    function getSalt(): string {
      return 'test';
    }

    function customBase64Encode(input: string): string {
      const chars = CUSTOM_BASE64_CHARS;
      let result = '';
      let i = 0;

      const utf8Str = input.replace(/\r\n/g, '\n');
      let utf8Bytes = '';
      for (let n = 0; n < utf8Str.length; n++) {
        const c = utf8Str.charCodeAt(n);
        if (c < 128) {
          utf8Bytes += String.fromCharCode(c);
        } else if (c > 127 && c < 2048) {
          utf8Bytes += String.fromCharCode((c >> 6) | 192);
          utf8Bytes += String.fromCharCode((c & 63) | 128);
        } else {
          utf8Bytes += String.fromCharCode((c >> 12) | 224);
          utf8Bytes += String.fromCharCode(((c >> 6) & 63) | 128);
          utf8Bytes += String.fromCharCode((c & 63) | 128);
        }
      }

      while (i < utf8Bytes.length) {
        const byte1 = utf8Bytes.charCodeAt(i++);
        const byte2 = i < utf8Bytes.length ? utf8Bytes.charCodeAt(i++) : NaN;
        const byte3 = i < utf8Bytes.length ? utf8Bytes.charCodeAt(i++) : NaN;

        const enc1 = byte1 >> 2;
        const enc2 = ((byte1 & 3) << 4) | (byte2 >> 4);
        let enc3 = ((byte2 & 15) << 2) | (byte3 >> 6);
        let enc4 = byte3 & 63;

        if (isNaN(byte2)) {
          enc3 = 64;
          enc4 = 64;
        } else if (isNaN(byte3)) {
          enc4 = 64;
        }

        result +=
          chars.charAt(enc1) +
          chars.charAt(enc2) +
          chars.charAt(enc3) +
          chars.charAt(enc4);
      }

      return result;
    }

    function md5Hex(input: string): string {
      function md5cycle(x: number[], k: number[]) {
        let a = x[0], b = x[1], c = x[2], d = x[3];
        a = ff(a, b, c, d, k[0], 7, -680876936);
        d = ff(d, a, b, c, k[1], 12, -389564586);
        c = ff(c, d, a, b, k[2], 17, 606105819);
        b = ff(b, c, d, a, k[3], 22, -1044525330);
        a = ff(a, b, c, d, k[4], 7, -176418897);
        d = ff(d, a, b, c, k[5], 12, 1200080426);
        c = ff(c, d, a, b, k[6], 17, -1473231341);
        b = ff(b, c, d, a, k[7], 22, -45705983);
        a = ff(a, b, c, d, k[8], 7, 1770035416);
        d = ff(d, a, b, c, k[9], 12, -1958414417);
        c = ff(c, d, a, b, k[10], 17, -42063);
        b = ff(b, c, d, a, k[11], 22, -1990404162);
        a = ff(a, b, c, d, k[12], 7, 1804603682);
        d = ff(d, a, b, c, k[13], 12, -40341101);
        c = ff(c, d, a, b, k[14], 17, -1502002290);
        b = ff(b, c, d, a, k[15], 22, 1236535329);
        a = gg(a, b, c, d, k[1], 5, -165796510);
        d = gg(d, a, b, c, k[6], 9, -1069501632);
        c = gg(c, d, a, b, k[11], 14, 643717713);
        b = gg(b, c, d, a, k[0], 20, -373897302);
        a = gg(a, b, c, d, k[5], 5, -701558691);
        d = gg(d, a, b, c, k[10], 9, 38016083);
        c = gg(c, d, a, b, k[15], 14, -660478335);
        b = gg(b, c, d, a, k[4], 20, -405537848);
        a = gg(a, b, c, d, k[9], 5, 568446438);
        d = gg(d, a, b, c, k[14], 9, -1019803690);
        c = gg(c, d, a, b, k[3], 14, -187363961);
        b = gg(b, c, d, a, k[8], 20, 1163531501);
        a = gg(a, b, c, d, k[13], 5, -1444681467);
        d = gg(d, a, b, c, k[2], 9, -51403784);
        c = gg(c, d, a, b, k[7], 14, 1735328473);
        b = gg(b, c, d, a, k[12], 20, -1926607734);
        a = hh(a, b, c, d, k[5], 4, -378558);
        d = hh(d, a, b, c, k[8], 11, -2022574463);
        c = hh(c, d, a, b, k[11], 16, 1839030562);
        b = hh(b, c, d, a, k[14], 23, -35309556);
        a = hh(a, b, c, d, k[1], 4, -1530992060);
        d = hh(d, a, b, c, k[4], 11, 1272893353);
        c = hh(c, d, a, b, k[7], 16, -155497632);
        b = hh(b, c, d, a, k[10], 23, -1094730640);
        a = hh(a, b, c, d, k[13], 4, 681279174);
        d = hh(d, a, b, c, k[0], 11, -358537222);
        c = hh(c, d, a, b, k[3], 16, -722521979);
        b = hh(b, c, d, a, k[6], 23, 76029189);
        a = hh(a, b, c, d, k[9], 4, -640364487);
        d = hh(d, a, b, c, k[12], 11, -421815835);
        c = hh(c, d, a, b, k[15], 16, 530742520);
        b = hh(b, c, d, a, k[2], 23, -995338651);
        a = ii(a, b, c, d, k[0], 6, -198630844);
        d = ii(d, a, b, c, k[7], 10, 1126891415);
        c = ii(c, d, a, b, k[14], 15, -1416354905);
        b = ii(b, c, d, a, k[5], 21, -57434055);
        a = ii(a, b, c, d, k[12], 6, 1700485571);
        d = ii(d, a, b, c, k[3], 10, -1894986606);
        c = ii(c, d, a, b, k[10], 15, -1051523);
        b = ii(b, c, d, a, k[1], 21, -2054922799);
        a = ii(a, b, c, d, k[8], 6, 1873313359);
        d = ii(d, a, b, c, k[15], 10, -30611744);
        c = ii(c, d, a, b, k[6], 15, -1560198380);
        b = ii(b, c, d, a, k[13], 21, 1309151649);
        a = ii(a, b, c, d, k[4], 6, -145523070);
        d = ii(d, a, b, c, k[11], 10, -1120210379);
        c = ii(c, d, a, b, k[2], 15, 718787259);
        b = ii(b, c, d, a, k[9], 21, -343485551);
        x[0] = add32(a, x[0]);
        x[1] = add32(b, x[1]);
        x[2] = add32(c, x[2]);
        x[3] = add32(d, x[3]);
      }

      function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
        a = add32(add32(a, q), add32(x, t));
        return add32((a << s) | (a >>> (32 - s)), b);
      }
      function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
        return cmn((b & c) | ((~b) & d), a, b, x, s, t);
      }
      function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
        return cmn((b & d) | (c & (~d)), a, b, x, s, t);
      }
      function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
        return cmn(b ^ c ^ d, a, b, x, s, t);
      }
      function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
        return cmn(c ^ (b | (~d)), a, b, x, s, t);
      }

      function add32(a: number, b: number) {
        return (a + b) & 0xFFFFFFFF;
      }

      function md5blk(s: string) {
        const md5blks: number[] = [];
        for (let i = 0; i < 64; i += 4) {
          md5blks[i >> 2] = s.charCodeAt(i) +
            (s.charCodeAt(i + 1) << 8) +
            (s.charCodeAt(i + 2) << 16) +
            (s.charCodeAt(i + 3) << 24);
        }
        return md5blks;
      }

      const hex_chr = '0123456789abcdef'.split('');

      function rhex(n: number) {
        let s = '';
        for (let j = 0; j < 4; j++) {
          s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
        }
        return s;
      }

      function hex(x: number[]) {
        return x.map(rhex).join('');
      }

      function md5raw(s: string): string {
        const n = s.length;
        const state = [1732584193, -271733879, -1732584194, 271733878];
        let i: number;
        for (i = 64; i <= n; i += 64) {
          md5cycle(state, md5blk(s.substring(i - 64, i)));
        }
        s = s.substring(i - 64);
        const tail = new Array(16).fill(0);
        for (i = 0; i < s.length; i++) {
          tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
        }
        tail[i >> 2] |= 0x80 << ((i % 4) << 3);
        if (i > 55) {
          md5cycle(state, tail);
          for (i = 0; i < 16; i++) tail[i] = 0;
        }
        tail[14] = n * 8;
        md5cycle(state, tail);
        return hex(state);
      }

      let utf8Input = '';
      for (let i = 0; i < input.length; i++) {
        const c = input.charCodeAt(i);
        if (c < 128) {
          utf8Input += String.fromCharCode(c);
        } else if (c < 2048) {
          utf8Input += String.fromCharCode(192 | (c >> 6));
          utf8Input += String.fromCharCode(128 | (c & 63));
        } else {
          utf8Input += String.fromCharCode(224 | (c >> 12));
          utf8Input += String.fromCharCode(128 | ((c >> 6) & 63));
          utf8Input += String.fromCharCode(128 | (c & 63));
        }
      }

      return md5raw(utf8Input);
    }

    function generatePgySign(path: string, data?: any): { 'X-s': string; 'X-t': string } {
      const timestamp = new Date().getTime();
      const salt = getSalt();

      const isObjectOrArray =
        Object.prototype.toString.call(data) === '[object Object]' ||
        Object.prototype.toString.call(data) === '[object Array]';

      const payload = isObjectOrArray && data ? JSON.stringify(data) : '';
      const raw = [timestamp, salt, path, payload].join('');

      const md5Hash = md5Hex(raw);
      const xS = customBase64Encode(md5Hash);

      return {
        'X-s': xS,
        'X-t': String(timestamp),
      };
    }

    function generateTraceId(): string {
      const chars = 'abcdef0123456789';
      return Array.from({ length: 16 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join('');
    }

    async function sendPgyRequest(config: {
      url: string;
      method?: string;
      params?: Record<string, any>;
      data?: any;
    }): Promise<any> {
      const method = (config.method || 'GET').toUpperCase();
      let fullUrl = config.url;

      if (method === 'GET' && config.params) {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(config.params)) {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
          }
        }
        const qs = searchParams.toString();
        if (qs) fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs;
      }

      const path = fullUrl.replace(PGY_BASE_URL, '');
      const signData = method === 'POST' ? config.data : undefined;
      const sign = generatePgySign(path, signData);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json;charset=UTF-8',
        'x-s': sign['X-s'],
        'x-t': sign['X-t'],
        'x-b3-traceid': generateTraceId(),
      };

      const fetchOptions: RequestInit = {
        method,
        headers,
        credentials: 'include',
      };

      if (method === 'POST' && config.data) {
        fetchOptions.body = JSON.stringify(config.data);
      }

      console.log('[智联AI] 蒲公英 API 请求:', method, fullUrl);
      const response = await fetch(fullUrl, fetchOptions);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.code && result.code !== 1000) {
        throw new Error(result.msg || '接口请求失败');
      }

      return result;
    }

    window.addEventListener('message', async (event) => {
      if (event.data?.type !== 'zl_pgy_api_request') {
        return;
      }

      const { requestId, path, params, method, source } = event.data;

      if (source === 'main') {
        return;
      }

      console.log('[智联AI] 蒲公英 MAIN world 收到API请求:', event.data);

      try {
        const fullPath = path.startsWith('http') ? path : (path.startsWith('/') ? PGY_BASE_URL + path : PGY_BASE_URL + '/' + path);

        const config = {
          url: fullPath,
          method: method || 'GET',
          params: method === 'GET' ? params : undefined,
          data: method === 'POST' ? params : undefined,
        };

        const response = await sendPgyRequest(config);

        window.postMessage({
          type: 'zl_pgy_api_response',
          requestId,
          source: 'main',
          response,
        }, '*');
      } catch (error) {
        console.error('[智联AI] 蒲公英 API 请求异常:', error);
        window.postMessage({
          type: 'zl_pgy_api_error',
          requestId,
          source: 'main',
          error: error instanceof Error ? error.message : '请求失败',
        }, '*');
      }
    });

    console.log('[智联AI] 蒲公英 MAIN world API 脚本已就绪');
  }
});
