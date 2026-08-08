const assert = require('assert');
const { createMockKV, makeContext, muteConsole } = require('./helpers');

const baseMetadata = {
  TimeStamp: 1710000000000,
  ListType: 'None',
  Label: 'None',
  liked: false,
  fileName: 'cat.png',
  fileSize: 123,
};

describe('manage API functions', function () {
  let restoreConsole;

  beforeEach(function () {
    restoreConsole = muteConsole();
  });

  afterEach(function () {
    restoreConsole();
  });

  it('marks a record as blocked while preserving other metadata', async function () {
    const { onRequest } = await import('../functions/api/manage/block/[id].js');
    const img_url = createMockKV({ 'cat.png': baseMetadata });

    const res = await onRequest(makeContext({
      env: { img_url },
      params: { id: 'cat.png' },
    }));

    assert.strictEqual(res.status, 200);
    const metadata = JSON.parse(await res.text());
    assert.strictEqual(metadata.ListType, 'Block');
    assert.strictEqual(metadata.fileName, 'cat.png');
    assert.deepStrictEqual(img_url.snapshot('cat.png').metadata, metadata);
  });

  it('marks a record as whitelisted while preserving other metadata', async function () {
    const { onRequest } = await import('../functions/api/manage/white/[id].js');
    const img_url = createMockKV({ 'cat.png': baseMetadata });

    const res = await onRequest(makeContext({
      env: { img_url },
      params: { id: 'cat.png' },
    }));

    assert.strictEqual(res.status, 200);
    const metadata = JSON.parse(await res.text());
    assert.strictEqual(metadata.ListType, 'White');
    assert.strictEqual(metadata.fileSize, 123);
    assert.deepStrictEqual(img_url.snapshot('cat.png').metadata, metadata);
  });

  it('deletes a KV record and returns the deleted id', async function () {
    const { onRequest } = await import('../functions/api/manage/delete/[id].js');
    const img_url = createMockKV({ 'cat.png': baseMetadata });

    const res = await onRequest(makeContext({
      env: { img_url },
      params: { id: 'cat.png' },
    }));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(await res.text(), '"cat.png"');
    assert.deepStrictEqual(img_url.operations.delete, ['cat.png']);
    assert.strictEqual(img_url.snapshot('cat.png'), undefined);
  });

  it('removes the short link mapping when deleting a record', async function () {
    const { onRequest } = await import('../functions/api/manage/delete/[id].js');
    const img_url = createMockKV({
      'cat.png': { ...baseMetadata, shortId: 'AbC123' },
      'short:AbC123': { value: 'cat.png', metadata: { target: 'cat.png' } },
    });

    const res = await onRequest(makeContext({
      env: { img_url },
      params: { id: 'cat.png' },
    }));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(img_url.snapshot('cat.png'), undefined);
    assert.strictEqual(img_url.snapshot('short:AbC123'), undefined);
  });

  it('hides internal bookkeeping keys from list results', async function () {
    const { onRequest } = await import('../functions/api/manage/list.js');
    const img_url = createMockKV({
      'cat.png': baseMetadata,
      'r2-1234abcd.png': baseMetadata,
      'short:AbC123': { value: 'cat.png', metadata: { target: 'cat.png' } },
      'moderation:live-models': { value: '[]', metadata: null },
    });

    const res = await onRequest(makeContext({
      request: new Request('https://example.com/api/manage/list'),
      env: { img_url },
    }));

    assert.strictEqual(res.status, 200);
    const data = JSON.parse(await res.text());
    assert.deepStrictEqual(data.keys.map(key => key.name), ['cat.png', 'r2-1234abcd.png']);
  });

  it('toggles the liked flag on an existing record', async function () {
    const { onRequest } = await import('../functions/api/manage/toggleLike/[id].js');
    const img_url = createMockKV({ 'cat.png': baseMetadata });

    const res = await onRequest(makeContext({
      env: { img_url },
      params: { id: 'cat.png' },
    }));

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(JSON.parse(await res.text()), {
      success: true,
      liked: true,
    });
    assert.strictEqual(img_url.snapshot('cat.png').metadata.liked, true);
  });

  it('updates the display filename from the newName query parameter', async function () {
    const { onRequest } = await import('../functions/api/manage/editName/[id].js');
    const img_url = createMockKV({ 'cat.png': baseMetadata });

    const res = await onRequest(makeContext({
      request: new Request('https://example.com/api/manage/editName/cat.png?newName=kitten.png'),
      env: { img_url },
      params: { id: 'cat.png' },
    }));

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(JSON.parse(await res.text()), {
      success: true,
      fileName: 'kitten.png',
    });
    assert.strictEqual(img_url.snapshot('cat.png').metadata.fileName, 'kitten.png');
  });

  it('returns 404 when toggling liked on a missing record', async function () {
    const { onRequest } = await import('../functions/api/manage/toggleLike/[id].js');
    const img_url = createMockKV();

    const res = await onRequest(makeContext({
      env: { img_url },
      params: { id: 'missing.png' },
    }));

    assert.strictEqual(res.status, 404);
    assert.strictEqual(await res.text(), 'Image metadata not found for ID: missing.png');
  });

  it('reports whether dashboard basic auth is configured', async function () {
    const { onRequest } = await import('../functions/api/manage/check.js');

    const disabled = await onRequest(makeContext({ env: {} }));
    assert.strictEqual(disabled.status, 200);
    assert.strictEqual(await disabled.text(), 'Not using basic auth.');

    const enabled = await onRequest(makeContext({ env: { BASIC_USER: 'admin' } }));
    assert.strictEqual(enabled.status, 200);
    assert.strictEqual(await enabled.text(), 'true');
  });
});

describe('manage API authentication middleware', function () {
  let restoreConsole;

  beforeEach(function () {
    restoreConsole = muteConsole();
  });

  afterEach(function () {
    restoreConsole();
  });

  async function getAuthentication() {
    const mod = await import('../functions/api/manage/_middleware.js');
    return mod.onRequest[1];
  }

  it('blocks dashboard requests when basic auth is configured and absent', async function () {
    const authentication = await getAuthentication();
    const img_url = createMockKV();

    const res = await authentication(makeContext({
      env: { img_url, BASIC_USER: 'admin', BASIC_PASS: 'secret' },
      request: new Request('https://example.com/api/manage/list'),
    }));

    assert.strictEqual(res.status, 401);
    assert.strictEqual(await res.text(), 'Authentication required.');
    assert.strictEqual(res.headers.get('WWW-Authenticate'), null);
  });

  it('allows dashboard requests with valid basic auth credentials', async function () {
    const authentication = await getAuthentication();
    const img_url = createMockKV();
    const headers = new Headers({
      Authorization: `Basic ${btoa('admin:secret')}`,
    });

    const res = await authentication(makeContext({
      env: { img_url, BASIC_USER: 'admin', BASIC_PASS: 'secret' },
      request: new Request('https://example.com/api/manage/list', { headers }),
      next: async () => new Response('ok'),
    }));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(await res.text(), 'ok');

  });

  it('rejects invalid dashboard credentials without opening a browser auth prompt', async function () {
    const authentication = await getAuthentication();
    const img_url = createMockKV();
    const headers = new Headers({
      Authorization: `Basic ${btoa('admin:wrong')}`,
    });

    const res = await authentication(makeContext({
      env: { img_url, BASIC_USER: 'admin', BASIC_PASS: 'secret' },
      request: new Request('https://example.com/api/manage/list', { headers }),
    }));

    assert.strictEqual(res.status, 401);
    assert.strictEqual(await res.text(), 'Invalid credentials.');
    assert.strictEqual(res.headers.get('WWW-Authenticate'), null);
  });

  it('lets the custom login endpoint run without existing authentication', async function () {
    const authentication = await getAuthentication();
    const img_url = createMockKV();

    const res = await authentication(makeContext({
      env: { img_url, BASIC_USER: 'admin', BASIC_PASS: 'secret' },
      request: new Request('https://example.com/api/manage/login', { method: 'POST' }),
      next: async () => new Response('login endpoint'),
    }));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(await res.text(), 'login endpoint');
  });

  it('accepts a signed session cookie created by the custom login endpoint', async function () {
    const { onRequestPost } = await import('../functions/api/manage/login.js');
    const authentication = await getAuthentication();
    const img_url = createMockKV();
    const env = { img_url, BASIC_USER: 'admin', BASIC_PASS: 'secret' };
    const loginResponse = await onRequestPost(makeContext({
      env,
      request: new Request('https://example.com/api/manage/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' },
        body: JSON.stringify({ user: 'admin', pass: 'secret' }),
      }),
    }));

    assert.strictEqual(loginResponse.status, 200);
    assert.deepStrictEqual(JSON.parse(await loginResponse.text()), { success: true });
    const setCookie = loginResponse.headers.get('Set-Cookie');
    assert.ok(setCookie.includes('telegraph_admin_session='));
    assert.ok(setCookie.includes('HttpOnly'));
    assert.ok(setCookie.includes('SameSite=Strict'));
    assert.ok(setCookie.includes('Secure'));

    const cookie = setCookie.split(';')[0];
    const res = await authentication(makeContext({
      env,
      request: new Request('https://example.com/api/manage/list', {
        headers: { Cookie: cookie },
      }),
      next: async () => new Response('ok'),
    }));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(await res.text(), 'ok');

    const [cookieName, token] = cookie.split('=');
    const mutationIndex = Math.floor(token.length / 2);
    const mutatedToken = `${token.slice(0, mutationIndex)}${token[mutationIndex] === 'A' ? 'B' : 'A'}${token.slice(mutationIndex + 1)}`;
    const rejected = await authentication(makeContext({
      env,
      request: new Request('https://example.com/api/manage/list', {
        headers: { Cookie: `${cookieName}=${mutatedToken}` },
      }),
    }));

    assert.strictEqual(rejected.status, 401);
    assert.strictEqual(rejected.headers.get('WWW-Authenticate'), null);
  });

  it('rejects invalid custom login credentials without setting a cookie', async function () {
    const { onRequestPost } = await import('../functions/api/manage/login.js');
    const res = await onRequestPost(makeContext({
      env: { BASIC_USER: 'admin', BASIC_PASS: 'secret' },
      request: new Request('https://example.com/api/manage/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: 'admin', pass: 'wrong' }),
      }),
    }));

    assert.strictEqual(res.status, 401);
    assert.strictEqual(await res.text(), 'Invalid credentials.');
    assert.strictEqual(res.headers.get('WWW-Authenticate'), null);
    assert.strictEqual(res.headers.get('Set-Cookie'), null);
  });

  it('clears the dashboard session cookie on logout', async function () {
    const { onRequestPost } = await import('../functions/api/manage/logout.js');
    const res = await onRequestPost(makeContext({
      request: new Request('https://example.com/api/manage/logout', { method: 'POST' }),
    }));

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(JSON.parse(await res.text()), { success: true });
    const setCookie = res.headers.get('Set-Cookie');
    assert.ok(setCookie.includes('telegraph_admin_session='));
    assert.ok(setCookie.includes('Max-Age=0'));
    assert.ok(setCookie.includes('HttpOnly'));
  });

  it('returns the dashboard disabled message when KV is not bound', async function () {
    const authentication = await getAuthentication();

    const res = await authentication(makeContext({
      env: { BASIC_USER: 'admin', BASIC_PASS: 'secret' },
      request: new Request('https://example.com/api/manage/list'),
    }));

    assert.strictEqual(res.status, 503);
    assert.strictEqual(await res.text(), 'Dashboard is disabled. Please bind a KV namespace to use this feature.');
    assert.strictEqual(res.headers.get('Content-Type'), 'text/plain;charset=UTF-8');
    assert.strictEqual(res.headers.get('Cache-Control'), 'no-store');
  });
});
