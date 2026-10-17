import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function ShareDialog({ docId, onClose }) {
  const [shares, setShares] = useState([]);
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.listShares(docId), api.users()])
      .then(([s, u]) => { setShares(s); setUsers(u); })
      .catch((e) => setError(e.message));
  }, [docId]);

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setShares(await api.share(docId, email, role));
      setEmail('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId) {
    setError('');
    try {
      setShares(await api.unshare(docId, userId));
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeRole(s, newRole) {
    setError('');
    try {
      setShares(await api.share(docId, s.email, newRole));
    } catch (err) {
      setError(err.message);
    }
  }

  const sharedIds = new Set(shares.map((s) => s.user_id));
  const options = users.filter((u) => !sharedIds.has(u.id));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card dialog" role="dialog" aria-modal="true" aria-label="Share document" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h3>Share document</h3>
          <button className="btn ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={add} className="row">
          <input list="share-users" type="email" placeholder="Add person by email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <datalist id="share-users">
            {options.map((u) => <option key={u.id} value={u.email}>{u.name}</option>)}
          </datalist>
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Permission">
            <option value="editor">Can edit</option>
            <option value="viewer">View only</option>
          </select>
          <button className="btn primary" disabled={busy || !email}>Share</button>
        </form>

        {error && <p className="error" role="alert">{error}</p>}

        <h4>People with access</h4>
        {shares.length === 0 && <p className="muted small">Only you can see this document.</p>}
        <ul className="shares">
          {shares.map((s) => (
            <li key={s.user_id}>
              <span className="avatar sm">{s.name[0]}</span>
              <span className="grow"><strong>{s.name}</strong><br /><small className="muted">{s.email}</small></span>
              <select value={s.role} onChange={(e) => changeRole(s, e.target.value)} aria-label={`Permission for ${s.name}`}>
                <option value="editor">Can edit</option>
                <option value="viewer">View only</option>
              </select>
              <button className="btn ghost danger" onClick={() => remove(s.user_id)}>Remove</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
