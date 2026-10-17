import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

/** Export dropdown: Markdown (server-generated download) and PDF (browser print dialog, "Save as PDF"). */
export default function ExportMenu({ docId, title, flush, onError }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  async function markdown() {
    setOpen(false);
    try {
      await flush(); // make sure the latest edits are saved before exporting
      await api.downloadMarkdown(docId, title);
    } catch (e) {
      onError(e.message);
    }
  }

  function pdf() {
    setOpen(false);
    const previous = document.title;
    document.title = title || 'document'; // becomes the suggested PDF file name
    const restore = () => {
      document.title = previous;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    setTimeout(() => window.print(), 50); // let the menu close first
  }

  return (
    <div className="menu" ref={ref}>
      <button className="btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Export ▾
      </button>
      {open && (
        <div className="menu-list" role="menu">
          <button role="menuitem" onClick={markdown}>Markdown (.md)</button>
          <button role="menuitem" onClick={pdf}>PDF (print / save as PDF)</button>
        </div>
      )}
    </div>
  );
}
