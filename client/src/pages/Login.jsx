import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('pyrochain_token', data.token);
        localStorage.setItem('pyrochain_user', JSON.stringify(data.user));
        navigate(data.user.role === 'firedept' ? '/firedept' : '/admin');
      } else {
        setError(data.message || 'Invalid credentials');
      }
    } catch {
      // Demo fallback logic remains for development
      if (
        (username === 'admin'    && password === 'admin123') ||
        (username === 'firedept' && password === 'firedept123')
      ) {
        const u = {
          username,
          role: username === 'admin' ? 'admin' : 'firedept',
          name: username === 'admin' ? 'System Admin' : 'Fire Dept Chief',
        };
        localStorage.setItem('pyrochain_token', 'demo-token');
        localStorage.setItem('pyrochain_user', JSON.stringify(u));
        navigate(u.role === 'firedept' ? '/firedept' : '/admin');
      } else {
        setError('Invalid username or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Brand header */}
        <div className="login-brand">
          <span className="login-brand-name">PyroChain</span>
        </div>

        <h1 className="login-title">Sign in</h1>
        <p className="login-subtitle">Fire Safety Monitoring Platform</p>

        <form onSubmit={handleLogin} className="login-form">
          <div className="login-field">
            <label className="login-label" htmlFor="username">Username</label>
            <input
              id="username"
              className="login-input"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              required
            />
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="password">Password</label>
            <input
              id="password"
              className="login-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
