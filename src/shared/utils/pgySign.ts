import md5 from 'md5-js';

const CUSTOM_BASE64_CHARS = 'A4NjFqYu5wPHsO0XTdDgMa2r1ZQocVte9UJBvk6/7=yRnhISGKblCWi+LpfE8xzm3';

const BROWSER_SALT = 'test';
const NON_BROWSER_SALT = 'iamspam';

function getSalt(): string {
  try {
    if (
      typeof window !== 'undefined' &&
      window !== undefined &&
      window.navigator &&
      window.navigator.userAgent &&
      typeof window.alert === 'function'
    ) {
      return BROWSER_SALT;
    }
  } catch {}
  return NON_BROWSER_SALT;
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

export interface PgySignResult {
  'X-s': string;
  'X-t': string;
}

export function generatePgySign(path: string, data?: unknown): PgySignResult {
  const timestamp = new Date().getTime();
  const salt = getSalt();

  const isObjectOrArray =
    Object.prototype.toString.call(data) === '[object Object]' ||
    Object.prototype.toString.call(data) === '[object Array]';

  const payload = isObjectOrArray && data ? JSON.stringify(data) : '';
  const raw = [timestamp, salt, path, payload].join('');

  const md5Hash = md5(raw);
  const xS = customBase64Encode(md5Hash);

  return {
    'X-s': xS,
    'X-t': String(timestamp),
  };
}

export function generateTraceId(): string {
  const chars = 'abcdef0123456789';
  return Array.from({ length: 16 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

export function buildPgyHeaders(path: string, data?: unknown): Record<string, string> {
  const sign = generatePgySign(path, data);
  return {
    'x-s': sign['X-s'],
    'x-t': sign['X-t'],
    'x-b3-traceid': generateTraceId(),
    'Content-Type': 'application/json;charset=UTF-8',
  };
}
