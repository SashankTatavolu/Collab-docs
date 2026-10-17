'use strict';
const Database = require('better-sqlite3');
const crypto = require('node:crypto');

const SEED_USERS = [
  { email: 'alice@example.com', name: 'Alice Johnson' },
  { email: 'bob@example.com', name: 'Bob Martinez' },
  { email: 'carol@example.com', name: 'Carol Singh' },
];

function openDb(file = ':memory:') {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Untitled document',
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS shares (
      doc_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('editor','viewer')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (doc_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_docs_owner ON documents(owner_id);
    CREATE INDEX IF NOT EXISTS idx_shares_user ON shares(user_id);
  `);
  const insert = db.prepare('INSERT OR IGNORE INTO users (email, name) VALUES (?, ?)');
  for (const u of SEED_USERS) insert.run(u.email, u.name);
  return db;
}

function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

module.exports = { openDb, newToken, SEED_USERS };
