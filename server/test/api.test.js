'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../app');
const { markdownToHtml } = require('../importers');

let server, base;
const tokens = {};

async function call(method, url, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(base + url, { method, headers, body: payload });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

before(async () => {
  const app = createApp({ dbFile: ':memory:', clientDist: '/nonexistent' });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
  for (const n of ['alice', 'bob', 'carol']) {
    const r = await call('POST', '/api/login', { body: { email: `${n}@example.com` } });
    tokens[n] = r.json.token;
  }
});
after(() => server.close());

test('requires authentication', async () => {
  assert.equal((await call('GET', '/api/docs')).status, 401);
});

test('create, rename, edit, and reopen a document (persistence + sanitizing)', async () => {
  const c = await call('POST', '/api/docs', { token: tokens.alice, body: { title: 'Plan' } });
  assert.equal(c.status, 201);
  const id = c.json.id;

  const u = await call('PUT', `/api/docs/${id}`, {
    token: tokens.alice,
    body: { title: 'Q4 Plan', content: '<h1>Hi</h1><p><strong>bold</strong> <u>u</u><script>alert(1)</script></p><ul><li><p>x</p></li></ul>' },
  });
  assert.equal(u.status, 200);
  assert.equal(u.json.title, 'Q4 Plan');

  const g = await call('GET', `/api/docs/${id}`, { token: tokens.alice });
  assert.match(g.json.content, /<h1>Hi<\/h1>/);
  assert.match(g.json.content, /<strong>bold<\/strong>/);
  assert.match(g.json.content, /<u>u<\/u>/);
  assert.match(g.json.content, /<ul><li><p>x<\/p><\/li><\/ul>/);
  assert.doesNotMatch(g.json.content, /script/);
});

test('validates titles and bodies', async () => {
  const { json: doc } = await call('POST', '/api/docs', { token: tokens.alice, body: {} });
  assert.equal((await call('PUT', `/api/docs/${doc.id}`, { token: tokens.alice, body: { title: '   ' } })).status, 400);
  assert.equal((await call('PUT', `/api/docs/${doc.id}`, { token: tokens.alice, body: { title: 'x'.repeat(201) } })).status, 400);
  assert.equal((await call('PUT', `/api/docs/${doc.id}`, { token: tokens.alice, body: {} })).status, 400);
  assert.equal((await call('GET', '/api/docs/99999', { token: tokens.alice })).status, 404);
});

test('sharing: access control, roles, owned vs shared lists', async () => {
  const { json: doc } = await call('POST', '/api/docs', { token: tokens.alice, body: { title: 'Shared spec' } });
  const id = doc.id;

  // Bob cannot see it before sharing (looks like 404, not 403)
  assert.equal((await call('GET', `/api/docs/${id}`, { token: tokens.bob })).status, 404);

  // Only the owner can share
  assert.equal((await call('POST', `/api/docs/${id}/shares`, { token: tokens.bob, body: { email: 'carol@example.com' } })).status, 404);

  // Validation
  assert.equal((await call('POST', `/api/docs/${id}/shares`, { token: tokens.alice, body: { email: 'nobody@example.com' } })).status, 404);
  assert.equal((await call('POST', `/api/docs/${id}/shares`, { token: tokens.alice, body: { email: 'alice@example.com' } })).status, 400);
  assert.equal((await call('POST', `/api/docs/${id}/shares`, { token: tokens.alice, body: { email: 'bob@example.com', role: 'admin' } })).status, 400);

  // Share as viewer with Bob, editor with Carol
  assert.equal((await call('POST', `/api/docs/${id}/shares`, { token: tokens.alice, body: { email: 'bob@example.com', role: 'viewer' } })).status, 201);
  assert.equal((await call('POST', `/api/docs/${id}/shares`, { token: tokens.alice, body: { email: 'carol@example.com', role: 'editor' } })).status, 201);

  // Bob: can read, cannot edit, cannot delete, cannot manage sharing
  const bobView = await call('GET', `/api/docs/${id}`, { token: tokens.bob });
  assert.equal(bobView.status, 200);
  assert.equal(bobView.json.role, 'viewer');
  assert.equal(bobView.json.can_edit, false);
  assert.equal((await call('PUT', `/api/docs/${id}`, { token: tokens.bob, body: { content: '<p>nope</p>' } })).status, 403);
  assert.equal((await call('DELETE', `/api/docs/${id}`, { token: tokens.bob })).status, 403);
  assert.equal((await call('GET', `/api/docs/${id}/shares`, { token: tokens.bob })).status, 403);

  // Carol: can edit, but not delete
  assert.equal((await call('PUT', `/api/docs/${id}`, { token: tokens.carol, body: { content: '<p>carol was here</p>' } })).status, 200);
  assert.equal((await call('DELETE', `/api/docs/${id}`, { token: tokens.carol })).status, 403);

  // Lists distinguish owned and shared
  const aliceList = (await call('GET', '/api/docs', { token: tokens.alice })).json;
  assert.ok(aliceList.owned.some((d) => d.id === id));
  assert.ok(!aliceList.shared.some((d) => d.id === id));
  const bobList = (await call('GET', '/api/docs', { token: tokens.bob })).json;
  assert.ok(!bobList.owned.some((d) => d.id === id));
  const entry = bobList.shared.find((d) => d.id === id);
  assert.equal(entry.role, 'viewer');
  assert.equal(entry.owner_email, 'alice@example.com');

  // Revoke
  const bobUserId = (await call('GET', '/api/me', { token: tokens.bob })).json.id;
  assert.equal((await call('DELETE', `/api/docs/${id}/shares/${bobUserId}`, { token: tokens.alice })).status, 200);
  assert.equal((await call('GET', `/api/docs/${id}`, { token: tokens.bob })).status, 404);

  // Owner can delete
  assert.equal((await call('DELETE', `/api/docs/${id}`, { token: tokens.alice })).status, 200);
});

function fileForm(name, content, type = 'text/plain') {
  const f = new FormData();
  f.append('file', new Blob([content], { type }), name);
  return f;
}

test('import: .md becomes an editable document with structure preserved', async () => {
  const md = '# Title\n\nSome **bold** and *italic* text.\n\n- one\n- two\n\n1. first\n2. second\n';
  const r = await call('POST', '/api/import', { token: tokens.alice, form: fileForm('notes.md', md) });
  assert.equal(r.status, 201);
  assert.equal(r.json.title, 'notes');
  assert.match(r.json.content, /<h1>Title<\/h1>/);
  assert.match(r.json.content, /<strong>bold<\/strong>/);
  assert.match(r.json.content, /<em>italic<\/em>/);
  assert.match(r.json.content, /<ul><li><p>one<\/p><\/li><li><p>two<\/p><\/li><\/ul>/);
  assert.match(r.json.content, /<ol><li><p>first<\/p><\/li><li><p>second<\/p><\/li><\/ol>/);
  assert.equal(r.json.role, 'owner');
});

test('import: .txt escapes HTML; unsupported and missing files are rejected', async () => {
  const r = await call('POST', '/api/import', { token: tokens.alice, form: fileForm('a.txt', 'hello <b>x</b>\n\nsecond') });
  assert.equal(r.status, 201);
  assert.match(r.json.content, /&lt;b&gt;x&lt;\/b&gt;/);

  const bad = await call('POST', '/api/import', { token: tokens.alice, form: fileForm('virus.exe', 'MZ') });
  assert.equal(bad.status, 415);
  assert.match(bad.json.error, /Supported/);

  assert.equal((await call('POST', '/api/import', { token: tokens.alice, form: new FormData() })).status, 400);
  assert.equal((await call('POST', '/api/import', { token: tokens.alice, form: fileForm('broken.docx', 'not a zip') })).status, 422);
});

test('markdownToHtml escapes raw HTML', () => {
  assert.equal(markdownToHtml('<script>x</script>'), '<p>&lt;script&gt;x&lt;/script&gt;</p>');
});

test('export: Markdown keeps structure; viewers can export; strangers cannot', async () => {
  const { json: doc } = await call('POST', '/api/docs', { token: tokens.alice, body: { title: 'Export me' } });
  const html = '<h1>Big</h1><h2>Sub</h2><p>Plain <strong>bold</strong> <em>ital</em> <u>under</u></p>' +
    '<ul><li><p>one</p></li><li><p>two</p></li></ul><ol><li><p>first</p></li><li><p>second</p></li></ol>';
  await call('PUT', `/api/docs/${doc.id}`, { token: tokens.alice, body: { content: html } });

  const get = (token, qs = '') => fetch(`${base}/api/docs/${doc.id}/export${qs}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

  const res = await get(tokens.alice);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/markdown/);
  assert.match(res.headers.get('content-disposition'), /Export%20me\.md/);
  const md = await res.text();
  assert.match(md, /^# Export me\n/);
  assert.match(md, /^# Big$/m);
  assert.match(md, /^## Sub$/m);
  assert.match(md, /Plain \*\*bold\*\* \*ital\* <u>under<\/u>/);
  assert.match(md, /^- one$/m);
  assert.match(md, /^- two$/m);
  assert.match(md, /^1\. first$/m);
  assert.match(md, /^2\. second$/m);

  // Not shared yet: Bob gets a 404; unauthenticated gets 401; bad format 400
  assert.equal((await get(tokens.bob)).status, 404);
  assert.equal((await get(null)).status, 401);
  assert.equal((await get(tokens.alice, '?format=docx')).status, 400);

  // Viewer can export
  await call('POST', `/api/docs/${doc.id}/shares`, { token: tokens.alice, body: { email: 'bob@example.com', role: 'viewer' } });
  assert.equal((await get(tokens.bob)).status, 200);
});
