import { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import EditorPage from './components/EditorPage.jsx';

function useHashRoute() {
  const parse = () => {
    const m = window.location.hash.match(/^#\/doc\/(\d+)/);
    return m ? { name: 'doc', id: Number(m[1]) } : { name: 'home' };
  };
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const navigate = (hash) => {
  window.location.hash = hash;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(Boolean(getToken()));
  const route = useHashRoute();

  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setBooting(false));
  }, []);

  const onLogin = useCallback(({ token, user }) => {
    setToken(token);
    setUser(user);
    navigate('#/');
  }, []);

  const onLogout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* session may already be gone */
    }
    setToken(null);
    setUser(null);
    navigate('#/');
  }, []);

  if (booting) return <div className="center muted">Loading…</div>;
  if (!user) return <Login onLogin={onLogin} />;

  return route.name === 'doc' ? (
    <EditorPage key={route.id} id={route.id} user={user} onLogout={onLogout} />
  ) : (
    <Dashboard user={user} onLogout={onLogout} />
  );
}
