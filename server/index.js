'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { createApp } = require('./app');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dbFile = path.join(dataDir, 'docs.sqlite');
const port = Number(process.env.PORT) || 3001;

createApp({ dbFile }).listen(port, '0.0.0.0', () => {
  console.log(`Collab Docs listening on http://localhost:${port}  (db: ${dbFile})`);
});
