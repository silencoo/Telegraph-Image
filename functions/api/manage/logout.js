import { clearAdminSessionCookie } from '../../utils/admin-session.js';
import { jsonResponse } from '../../utils/http.js';

function logoutResponse(request) {
  return jsonResponse(
    { success: true },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Set-Cookie': clearAdminSessionCookie(request),
      },
    },
  );
}

export function onRequestPost(context) {
  return logoutResponse(context.request);
}

export function onRequestGet(context) {
  const response = logoutResponse(context.request);
  const url = new URL(context.request.url);
  response.headers.set('Location', `${url.origin}/admin.html`);
  return new Response(response.body, {
    status: 302,
    headers: response.headers,
  });
}
