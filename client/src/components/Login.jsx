import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Login({ onLogin }) {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.demoUsers().then(setUsers).catch((e) => setError(e.message));
  }, []);

  async function signIn(addr) {
    setBusy(true);
    setError('');
    try {
      onLogin(await api.login(addr));
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="card login-card">
        <h1>Collab Docs</h1>
        <p className="muted">A lightweight collaborative editor. Sign in as a demo user to try sharing between accounts.</p>

        <div className="demo-users">
          {users.map((u) => (
            <button key={u.id} className="user-btn" disabled={busy} onClick={() => signIn(u.email)}>
              <span className="avatar">{u.name[0]}</span>
              <span>
                <strong>{u.name}</strong>
                <br />
                <small className="muted">{u.email}</small>
              </span>
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            signIn(email);
          }}
          className="row"
        >
          <input type="email" placeholder="or type a demo email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn" disabled={busy || !email}>Sign in</button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="muted small">Demo auth only: no passwords. Open a second browser profile as another user to see sharing live.</p>
      </div>
    </div>
  );
}
