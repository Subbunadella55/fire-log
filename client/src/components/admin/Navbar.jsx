import { useState, useEffect } from 'react';
import './Navbar.css';

export default function Navbar({ user, sensorOnline, onLogout }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('pyrochain_theme') || 'dark');

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem('pyrochain_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <nav className="pc-navbar">
      <a href="/" className="pc-brand">
        <span className="pc-brand-mark">PC</span>
        <span className="pc-brand-name">PyroChain</span>
      </a>

      <div className="pc-nav-links">
        <a href="/admin" className="pc-nav-link active">Admin</a>
        <a href="/firedept" className="pc-nav-link">Fire Dept</a>
      </div>

      <div className="pc-nav-right">
        <button className="pc-btn-theme" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>

        <span className={`pc-sensor-badge ${sensorOnline ? 'online' : 'offline'}`}>
          <span className="pc-sensor-dot" />
          <span>{sensorOnline ? 'Sensor Online' : 'Sensor Offline'}</span>
        </span>

        <span className="pc-nav-user">{user?.name || user?.username || 'Admin'}</span>

        <button className="pc-btn-logout" onClick={onLogout}>Sign Out</button>
      </div>
    </nav>
  );
}
