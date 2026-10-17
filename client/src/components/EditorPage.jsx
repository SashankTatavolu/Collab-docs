import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { api } from '../api.js';
import { navigate } from '../App.jsx';
import ShareDialog from './ShareDialog.jsx';
import Toolbar from './Toolbar.jsx';
import ExportMenu from './ExportMenu.jsx';

const AUTOSAVE_MS = 800;

export default function EditorPage({ id, user, onLogout }) {
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getDoc(id).then(setDoc).catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="page">
        <TopBar user={user} onLogout={onLogout} />
        <main className="container">
          <p className="error" role="alert">{error}</p>
          <button className="btn" onClick={() => navigate('#/')}>← Back to documents</button>
        </main>
      </div>
    );
  }
  if (!doc) return <div className="center muted">Loading document…</div>;
  return <Loaded doc={doc} user={user} onLogout={onLogout} />;
}

function TopBar({ user, onLogout, children }) {
  return (
    <header className="topbar">
      <button className="btn ghost" onClick={() => navigate('#/')} aria-label="Back to documents">← Docs</button>
      {children}
      <span className="spacer" />
      <span className="avatar sm">{user.name[0]}</span>
      <span className="who">{user.name}</span>
      <button className="btn ghost" onClick={onLogout}>Sign out</button>
    </header>
  );
}

function Loaded({ doc, user, onLogout }) {
  const canEdit = doc.can_edit;
  const isOwner = doc.role === 'owner';
  const [title, setTitle] = useState(doc.title);
  const [status, setStatus] = useState('saved'); // saved | dirty | saving | error
  const [message, setMessage] = useState('');
  const [sharing, setSharing] = useState(false);

  const latest = useRef({ title: doc.title, content: doc.content });
  const pending = useRef({}); // fields changed since last successful save
  const timer = useRef(null);
  const inflight = useRef(null);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (inflight.current) await inflight.current;
    const patch = pending.current;
    if (!Object.keys(patch).length) return;
    pending.current = {};
    setStatus('saving');
    const p = api
      .updateDoc(doc.id, patch)
      .then(() => {
        setStatus(Object.keys(pending.current).length ? 'dirty' : 'saved');
        setMessage('');
      })
      .catch((e) => {
        pending.current = { ...patch, ...pending.current }; // keep for retry
        setStatus('error');
        setMessage(e.message);
      })
      .finally(() => { inflight.current = null; });
    inflight.current = p;
    await p;
  }, [doc.id]);

  const schedule = useCallback(
    (patch) => {
      pending.current = { ...pending.current, ...patch };
      setStatus('dirty');
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, AUTOSAVE_MS);
    },
    [flush]
  );

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } }), Underline],
    content: doc.content || '',
    editable: canEdit,
    editorProps: { attributes: { class: 'prose', 'aria-label': 'Document body' } },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      latest.current.content = html;
      schedule({ content: html });
    },
  });

  // Flush pending edits when leaving the page / closing the tab.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (Object.keys(pending.current).length) {
        flush();
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      flush();
    };
  }, [flush]);

  function commitTitle() {
    const t = title.trim();
    if (!t) {
      setTitle(latest.current.title);
      setMessage('Title cannot be empty.');
      return;
    }
    if (t !== latest.current.title) {
      latest.current.title = t;
      setTitle(t);
      schedule({ title: t });
      flush();
    }
  }

  const statusText = {
    saved: 'All changes saved',
    dirty: 'Unsaved changes…',
    saving: 'Saving…',
    error: 'Save failed',
  }[status];

  return (
    <div className="page editor-page">
      <TopBar user={user} onLogout={onLogout}>
        <input
          className="title-input"
          value={title}
          disabled={!canEdit}
          maxLength={200}
          aria-label="Document title"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        {canEdit && <span className={`save-status ${status}`} aria-live="polite">{statusText}</span>}
        {status === 'error' && <button className="btn" onClick={flush}>Retry</button>}
        <span className={`badge ${doc.role}`}>{isOwner ? 'Owner' : doc.role === 'editor' ? 'Can edit' : 'View only'}</span>
        <ExportMenu docId={doc.id} title={title} flush={flush} onError={setMessage} />
        {isOwner && <button className="btn primary" onClick={() => setSharing(true)}>Share</button>}
      </TopBar>

      {!isOwner && (
        <div className="banner">
          Shared by <strong>{doc.owner.name}</strong> ({doc.owner.email}) · {canEdit ? 'you can edit this document' : 'view only, you cannot edit'}
        </div>
      )}
      {message && <div className="banner warn" role="alert">{message}</div>}

      {canEdit && <Toolbar editor={editor} />}
      <main className="sheet-wrap">
        <div className="sheet">
          <EditorContent editor={editor} />
        </div>
      </main>

      {sharing && <ShareDialog docId={doc.id} onClose={() => setSharing(false)} />}
    </div>
  );
}
