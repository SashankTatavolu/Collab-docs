'use strict';
const TurndownService = require('turndown');

const td = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
  codeBlockStyle: 'fenced',
});

// Markdown has no underline; keep it as inline HTML so the formatting is not silently lost.
td.addRule('underline', {
  filter: ['u'],
  replacement: (content) => (content.trim() ? `<u>${content}</u>` : content),
});

// Tiptap wraps list item text in <p>; unwrap so lists stay tight ("- item" not "- \n\n item").
td.addRule('tightListParagraph', {
  filter: (node) => node.nodeName === 'P' && node.parentNode && node.parentNode.nodeName === 'LI',
  replacement: (content) => content,
});

function htmlToMarkdown(title, html) {
  // Turndown pads list markers ("-   x", "1.  x"); normalize to a single space.
  const body = td.turndown(html || '').replace(/^(\s*(?:[-*+]|\d+\.)) {2,}/gm, '$1 ');
  return `# ${title}\n\n${body}\n`;
}

/** Safe ASCII-ish filename (no path chars), keeping unicode letters. */
function fileSafe(title) {
  const s = String(title).replace(/[\\/:*?"<>|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
  return s || 'document';
}

module.exports = { htmlToMarkdown, fileSafe };
