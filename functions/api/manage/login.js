import {
  createAdminSessionCookie,
  verifyAdminCredentials,
} from '../../utils/admin-session.js';
import { dashboardUnauthorizedResponse } from '../../utils/auth.js';
import { isEmptyBinding, jsonResponse } from '../../utils/http.js';

const MAX_LOGIN_BODY_BYTES = 4096;

async function readLoginBody(request) {
  if (!request.body) return { error: 'invalid' };

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_LOGIN_BODY_BYTES) {
      await reader.cancel();
      return { error: 'too-large' };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { error: 'invalid' };
  }
}

export function onRequestGet(context) {
  const url = new URL(context.request.url);
  return Response.redirect(`${url.origin}/admin.html`, 302);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (isEmptyBinding(env.BASIC_USER) || isEmptyBinding(env.BASIC_PASS)) {
    return jsonResponse({ error: 'Dashboard login is not configured.' }, { status: 409 });
  }

  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    return dashboardUnauthorizedResponse('Invalid request origin.');
  }

  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > MAX_LOGIN_BODY_BYTES) {
    return jsonResponse({ error: 'Login request is too large.' }, { status: 413 });
  }

  const parsed = await readLoginBody(request);
  if (parsed.error === 'too-large') {
    return jsonResponse({ error: 'Login request is too large.' }, { status: 413 });
  }
  if (parsed.error) {
    return jsonResponse({ error: 'Invalid login request.' }, { status: 400 });
  }

  const body = parsed.body;
  const user = typeof body?.user === 'string' ? body.user : '';
  const pass = typeof body?.pass === 'string' ? body.pass : '';
  if (user.length > 256 || pass.length > 1024) {
    return dashboardUnauthorizedResponse('Invalid credentials.');
  }

  if (!await verifyAdminCredentials(env, user, pass)) {
    return dashboardUnauthorizedResponse('Invalid credentials.');
  }

  return jsonResponse(
    { success: true },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Set-Cookie': await createAdminSessionCookie(request, env),
      },
    },
  );
}
