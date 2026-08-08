const SESSION_COOKIE = 'telegraph_admin_session';
const SESSION_VERSION = 'v1';
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const textEncoder = new TextEncoder();

function encodeBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
}

function decodeBase64Url(value) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(`${normalized}${padding}`);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function importSessionKey(env) {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(`${env.BASIC_USER}\0${env.BASIC_PASS}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function sessionPayload(env, expiresAt) {
  return `${SESSION_VERSION}.${env.BASIC_USER}.${expiresAt}`;
}

function readCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  for (const item of cookieHeader.split(';')) {
    const [cookieName, ...parts] = item.trim().split('=');
    if (cookieName !== name) continue;
    try {
      return decodeURIComponent(parts.join('='));
    } catch {
      return null;
    }
  }
  return null;
}

function cookieAttributes(request, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `Path=/api/manage; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function constantTimeEqual(left, right) {
  if (typeof crypto.subtle.timingSafeEqual === 'function') {
    return crypto.subtle.timingSafeEqual(left, right);
  }

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', textEncoder.encode(value)));
}

export async function verifyAdminCredentials(env, user, pass) {
  const [actualUser, expectedUser, actualPass, expectedPass] = await Promise.all([
    digest(user),
    digest(env.BASIC_USER || ''),
    digest(pass),
    digest(env.BASIC_PASS || ''),
  ]);

  return constantTimeEqual(actualUser, expectedUser)
    && constantTimeEqual(actualPass, expectedPass);
}

export async function createAdminSessionCookie(request, env) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = sessionPayload(env, expiresAt);
  const key = await importSessionKey(env);
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payload));
  const token = `${SESSION_VERSION}.${expiresAt}.${encodeBase64Url(new Uint8Array(signature))}`;
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${cookieAttributes(request, SESSION_TTL_SECONDS)}`;
}

export function clearAdminSessionCookie(request) {
  return `${SESSION_COOKIE}=; ${cookieAttributes(request, 0)}`;
}

export async function hasValidAdminSession(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return false;

  const [version, expiresValue, encodedSignature, ...extra] = token.split('.');
  const expiresAt = Number(expiresValue);
  const now = Math.floor(Date.now() / 1000);
  if (
    version !== SESSION_VERSION
    || extra.length
    || !Number.isSafeInteger(expiresAt)
    || expiresAt <= now
    || expiresAt > now + SESSION_TTL_SECONDS
  ) {
    return false;
  }

  try {
    const key = await importSessionKey(env);
    return await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(encodedSignature),
      textEncoder.encode(sessionPayload(env, expiresAt)),
    );
  } catch {
    return false;
  }
}
