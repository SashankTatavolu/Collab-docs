'use strict';
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sanitizeHtml = require('sanitize-html');
const { openDb, newToken } = require('./db');
const { importFile, SUPPORTED } = require('./importers');
const { htmlToMarkdown, fileSafe } = require('./exporters');

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_TITLE = 200;

const SANITIZE = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr'],
  allowedAttributes: {},
};
const clean = (html) => sanitizeHtml(String(html ?? ''), SANITIZE);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function validTitle(t) {
  if (typeof t !== 'string') throw new HttpError(400, 'Title must be a string.');
  const title = t.trim();
  if (!title) throw new HttpError(400, 'Title cannot be empty.');
  if (title.length > MAX_TITLE) throw new HttpError(400, `Title must be at most ${MAX_TITLE} characters.`);
  return title;
}

function createApp({ dbFile = ':memory:', clientDist } = {}) {
  const db = openDb(dbFile);
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

  // ---------- prepared statements ----------
  const q = {
    userByEmail: db.prepare('SELECT id, email, name FROM users WHERE email = ?'),
    userById: db.prepare('SELECT id, email, name FROM users WHERE id = ?'),
    allUsers: db.prepare('SELECT id, email, name FROM users ORDER BY name'),
    session: db.prepare('SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'),
    addSession: db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)'),
    delSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
    owned: db.prepare(`SELECT d.id, d.title, d.updated_at, d.owner_id, u.name AS owner_name, u.email AS owner_email,
        (SELECT COUNT(*) FROM shares s WHERE s.doc_id = d.id) AS share_count
        FROM documents d JOIN users u ON u.id = d.owner_id WHERE d.owner_id = ? ORDER BY d.updated_at DESC, d.id DESC`),
    shared: db.prepare(`SELECT d.id, d.title, d.updated_at, d.owner_id, u.name AS owner_name, u.email AS owner_email, s.role
        FROM shares s JOIN documents d ON d.id = s.doc_id JOIN users u ON u.id = d.owner_id
        WHERE s.user_id = ? ORDER BY d.updated_at DESC, d.id DESC`),
    docById: db.prepare(`SELECT d.*, u.name AS owner_name, u.email AS owner_email FROM documents d JOIN users u ON u.id = d.owner_id WHERE d.id = ?`),
    shareRole: db.prepare('SELECT role FROM shares WHERE doc_id = ? AND user_id = ?'),
    insertDoc: db.prepare('INSERT INTO documents (owner_id, title, content) VALUES (?, ?, ?)'),
    updateDoc: db.prepare(`UPDATE documents SET title = COALESCE(?, title), content = COALESCE(?, content), updated_at = datetime('now') WHERE id = ?`),
    deleteDoc: db.prepare('DELETE FROM documents WHERE id = ?'),
    listShares: db.prepare('SELECT u.id AS user_id, u.name, u.email, s.role FROM shares s JOIN users u ON u.id = s.user_id WHERE s.doc_id = ? ORDER BY u.name'),
    upsertShare: db.prepare(`INSERT INTO shares (doc_id, user_id, role) VALUES (?, ?, ?)
        ON CONFLICT(doc_id, user_id) DO UPDATE SET role = excluded.role`),
    deleteShare: db.prepare('DELETE FROM shares WHERE doc_id = ? AND user_id = ?'),
  };

  // ---------- middleware / helpers ----------
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  function auth(req, _res, next) {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    const user = token ? q.session.get(token) : null;
    if (!user) return next(new HttpError(401, 'Please sign in.'));
    req.user = user;
    req.token = token;
    next();
  }

  /** Returns { doc, role } where role is owner|editor|viewer. Non-accessible docs look like 404. */
  function access(docId, user) {
    const id = Number(docId);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Document not found.');
    const doc = q.docById.get(id);
    if (!doc) throw new HttpError(404, 'Document not found.');
    if (doc.owner_id === user.id) return { doc, role: 'owner' };
    const s = q.shareRole.get(id, user.id);
    if (!s) throw new HttpError(404, 'Document not found.');
    return { doc, role: s.role };
  }

  const present = (doc, role) => ({
    id: doc.id,
    title: doc.title,
    content: doc.content,
    updated_at: doc.updated_at,
    owner: { id: doc.owner_id, name: doc.owner_name, email: doc.owner_email },
    role,
    can_edit: role === 'owner' || role === 'editor',
  });

  // ---------- auth ----------
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/demo-users', (_req, res) => res.json(q.allUsers.all()));

  app.post('/api/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) throw new HttpError(400, 'Email is required.');
    const user = q.userByEmail.get(email);
    if (!user) throw new HttpError(404, 'No such demo user. Use one of the seeded accounts.');
    const token = newToken();
    q.addSession.run(token, user.id);
    res.json({ token, user });
  });

  app.post('/api/logout', auth, (req, res) => {
    q.delSession.run(req.token);
    res.json({ ok: true });
  });

  app.get('/api/me', auth, (req, res) => res.json(req.user));
  app.get('/api/users', auth, (req, res) => res.json(q.allUsers.all().filter((u) => u.id !== req.user.id)));

  // ---------- documents ----------
  app.get('/api/docs', auth, (req, res) => {
    res.json({ owned: q.owned.all(req.user.id), shared: q.shared.all(req.user.id) });
  });

  app.post('/api/docs', auth, (req, res) => {
    const title = req.body?.title === undefined ? 'Untitled document' : validTitle(req.body.title);
    const info = q.insertDoc.run(req.user.id, title, '');
    const { doc, role } = access(info.lastInsertRowid, req.user);
    res.status(201).json(present(doc, role));
  });

  app.get('/api/docs/:id', auth, (req, res) => {
    const { doc, role } = access(req.params.id, req.user);
    res.json({ ...present(doc, role), shares: role === 'owner' ? q.listShares.all(doc.id) : undefined });
  });

  app.put('/api/docs/:id', auth, (req, res) => {
    const { doc, role } = access(req.params.id, req.user);
    if (role === 'viewer') throw new HttpError(403, 'You have view-only access to this document.');
    const body = req.body || {};
    if (body.title === undefined && body.content === undefined) throw new HttpError(400, 'Nothing to update.');
    const title = body.title === undefined ? null : validTitle(body.title);
    let content = null;
    if (body.content !== undefined) {
      if (typeof body.content !== 'string') throw new HttpError(400, 'Content must be an HTML string.');
      content = clean(body.content);
    }
    q.updateDoc.run(title, content, doc.id);
    const fresh = access(doc.id, req.user);
    res.json(present(fresh.doc, fresh.role));
  });

  app.delete('/api/docs/:id', auth, (req, res) => {
    const { doc, role } = access(req.params.id, req.user);
    if (role !== 'owner') throw new HttpError(403, 'Only the owner can delete a document.');
    q.deleteDoc.run(doc.id);
    res.json({ ok: true });
  });

  // ---------- export (any role with access) ----------
  app.get('/api/docs/:id/export', auth, (req, res) => {
    const { doc } = access(req.params.id, req.user);
    const format = String(req.query.format || 'md').toLowerCase();
    if (format !== 'md') throw new HttpError(400, 'Unsupported export format. Use format=md (PDF is produced in the browser via Print).');
    const name = fileSafe(doc.title);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="document.md"; filename*=UTF-8''${encodeURIComponent(name)}.md`);
    res.send(htmlToMarkdown(doc.title, doc.content));
  });

  // ---------- sharing (owner only) ----------
  app.get('/api/docs/:id/shares', auth, (req, res) => {
    const { doc, role } = access(req.params.id, req.user);
    if (role !== 'owner') throw new HttpError(403, 'Only the owner can manage sharing.');
    res.json(q.listShares.all(doc.id));
  });

  app.post('/api/docs/:id/shares', auth, (req, res) => {
    const { doc, role } = access(req.params.id, req.user);
    if (role !== 'owner') throw new HttpError(403, 'Only the owner can manage sharing.');
    const email = String(req.body?.email || '').trim().toLowerCase();
    const shareRole = req.body?.role ?? 'editor';
    if (!email) throw new HttpError(400, 'Email is required.');
    if (!['editor', 'viewer'].includes(shareRole)) throw new HttpError(400, 'Role must be "editor" or "viewer".');
    const target = q.userByEmail.get(email);
    if (!target) throw new HttpError(404, `No user with email ${email}.`);
    if (target.id === req.user.id) throw new HttpError(400, 'You already own this document.');
    q.upsertShare.run(doc.id, target.id, shareRole);
    res.status(201).json(q.listShares.all(doc.id));
  });

  app.delete('/api/docs/:id/shares/:userId', auth, (req, res) => {
    const { doc, role } = access(req.params.id, req.user);
    if (role !== 'owner') throw new HttpError(403, 'Only the owner can manage sharing.');
    q.deleteShare.run(doc.id, Number(req.params.userId));
    res.json(q.listShares.all(doc.id));
  });

  // ---------- file import ----------
  app.get('/api/import/supported', (_req, res) => res.json({ extensions: SUPPORTED, max_bytes: MAX_UPLOAD_BYTES }));

  app.post(
    '/api/import',
    auth,
    (req, res, next) => upload.single('file')(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, `File too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).`));
      next(new HttpError(400, 'Upload failed: ' + err.message));
    }),
    wrap(async (req, res) => {
      if (!req.file) throw new HttpError(400, 'Attach a file in the "file" field.');
      let result;
      try {
        result = await importFile(req.file);
      } catch (e) {
        throw new HttpError(e.status || 400, e.message);
      }
      const info = q.insertDoc.run(req.user.id, result.title, clean(result.html));
      const { doc, role } = access(info.lastInsertRowid, req.user);
      res.status(201).json(present(doc, role));
    })
  );

  // ---------- static client (production) ----------
  const dist = clientDist || path.join(__dirname, '..', 'client', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // ---------- errors ----------
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || (err.type === 'entity.too.large' ? 413 : err.type === 'entity.parse.failed' ? 400 : 500);
    if (status >= 500) console.error(err);
    const message = status >= 500 ? 'Something went wrong on the server.' : err.type === 'entity.parse.failed' ? 'Invalid JSON body.' : err.message;
    res.status(status).json({ error: message });
  });

  app.locals.db = db;
  return app;
}

module.exports = { createApp };
