import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { navigate } from '../App.jsx';

const fmt = (s) => new Date(s.replace(' ', 'T') + 'Z').toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export default function Dashboard({ user, onLogout }) {
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState({ extensions: ['.txt', '.md', '.docx'], max_bytes: 5242880 });
  const fileRef = useRef(null);

  const load = useCallback(() => {
    api.listDocs().then(setDocs).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    api.importInfo().then(setInfo).catch(() => {});
  }, [load]);

  async function create() {
    setError('');
    try {
      const d = await api.createDoc();
      navigate(`#/doc/${d.id}`);
    } catch (e) {
      setError(e.message);
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const d = await api.importFile(file);
      navigate(`#/doc/${d.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(d) {
    if (!window.confirm(`Delete "${d.title}"? This also removes it for anyone it is shared with.`)) return;
    try {
      await api.deleteDoc(d.id);
      setNotice(`Deleted "${d.title}".`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <strong className="brand">Collab Docs</strong>
        <span className="spacer" />
        <span className="avatar sm">{user.name[0]}</span>
        <span className="who">{user.name}</span>
        <button className="btn ghost" onClick={onLogout}>Sign out</button>
      </header>

      <main className="container">
        <div className="actions">
          <button className="btn primary" onClick={create}>+ New document</button>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Importing…' : 'Import file'}
          </button>
          <input ref={fileRef} type="file" hidden accept={info.extensions.join(',')} onChange={onFile} />
          <span className="muted small">
            Import supports {info.extensions.join(', ')} (max {Math.round(info.max_bytes / 1024 / 1024)} MB). The file becomes a new editable document.
          </span>
        </div>

        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="notice">{notice}</p>}
        {!docs && !error && <p className="muted">Loading documents…</p>}

        {docs && (
          <>
            <h2>My documents</h2>
            <DocTable
              rows={docs.owned}
              empty="You have no documents yet. Create one or import a file."
              render={(d) => (
                <>
                  <td><Badge kind="owner">Owner</Badge>{d.share_count > 0 && <span className="muted small"> · shared with {d.share_count}</span>}</td>
                  <td className="muted">{fmt(d.updated_at)}</td>
                  <td className="right"><button className="btn ghost danger" onClick={(e) => { e.stopPropagation(); remove(d); }}>Delete</button></td>
                </>
              )}
            />

            <h2>Shared with me</h2>
            <DocTable
              rows={docs.shared}
              empty="Nothing has been shared with you yet."
              render={(d) => (
                <>
                  <td><Badge kind={d.role}>{d.role === 'editor' ? 'Can edit' : 'View only'}</Badge><span className="muted small"> · from {d.owner_name}</span></td>
                  <td className="muted">{fmt(d.updated_at)}</td>
                  <td />
                </>
              )}
            />
          </>
        )}
      </main>
    </div>
  );
}

function Badge({ kind, children }) {
  return <span className={`badge ${kind}`}>{children}</span>;
}

function DocTable({ rows, empty, render }) {
  if (!rows.length) return <p className="muted empty">{empty}</p>;
  return (
    <table className="docs">
      <thead>
        <tr><th>Title</th><th>Access</th><th>Last modified</th><th /></tr>
      </thead>
      <tbody>
        {rows.map((d) => (
          <tr key={d.id} tabIndex={0} onClick={() => navigate(`#/doc/${d.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`#/doc/${d.id}`)}>
            <td className="title">{d.title}</td>
            {render(d)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
