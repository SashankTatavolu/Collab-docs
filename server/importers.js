'use strict';
const mammoth = require('mammoth');

const SUPPORTED = ['.txt', '.md', '.markdown', '.docx'];

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s) {
  let t = esc(s);
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/__(.+?)__/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
  t = t.replace(/(^|[^_\w])_(?!\s)(.+?)_(?![_\w])/g, '$1<em>$2</em>');
  return t;
}

/** Tiny Markdown subset -> HTML: headings, bold/italic, bullet + numbered lists, paragraphs. */
function markdownToHtml(md) {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let list = null; // 'ul' | 'ol'
  let para = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) {
      flushPara();
      closeList();
    } else if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flushPara();
      closeList();
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
    } else if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) {
      flushPara();
      if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
      out.push(`<li><p>${inline(m[1])}</p></li>`);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara();
      if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; }
      out.push(`<li><p>${inline(m[1])}</p></li>`);
    } else {
      closeList();
      para.push(line.trim());
    }
  }
  flushPara();
  closeList();
  return out.join('');
}

function textToHtml(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function extOf(name) {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i).toLowerCase();
}

/** Returns { title, html }. Throws Error with .status = 400/415 on bad input. */
async function importFile({ originalname, buffer }) {
  const ext = extOf(originalname);
  if (!SUPPORTED.includes(ext)) {
    const e = new Error(`Unsupported file type "${ext || 'unknown'}". Supported: ${SUPPORTED.join(', ')}`);
    e.status = 415;
    throw e;
  }
  const title = originalname.replace(/\.[^.]+$/, '').slice(0, 200) || 'Imported document';
  let html;
  try {
    if (ext === '.docx') {
      const res = await mammoth.convertToHtml({ buffer });
      html = res.value;
    } else if (ext === '.txt') {
      html = textToHtml(buffer.toString('utf8'));
    } else {
      html = markdownToHtml(buffer.toString('utf8'));
    }
  } catch (err) {
    const e = new Error('Could not read that file. Is it a valid, non-corrupted ' + ext + ' file?');
    e.status = 422;
    throw e;
  }
  return { title, html: html || '<p></p>' };
}

module.exports = { importFile, markdownToHtml, textToHtml, SUPPORTED };
