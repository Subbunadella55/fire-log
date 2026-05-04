import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';
import {
  LayoutDashboard, Bell, Activity, Link2, BarChart3,
  Shield, Settings, Search, ChevronLeft, ChevronRight,
  Menu, X, LogOut, Circle,
} from 'lucide-react';
import './Sidebar.css';

const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',     icon: LayoutDashboard, path: '/admin',     badge: null },
  { id: 'alerts',      label: 'Alert Log',     icon: Bell,            path: '/admin/alerts',    badge: null },
  { id: 'sensors',     label: 'Sensor Status', icon: Activity,        path: '/admin/sensors',   badge: null },
  { id: 'blockchain',  label: 'Blockchain',    icon: Link2,           path: '/admin/blockchain',badge: null },
  { id: 'analytics',   label: 'Analytics',     icon: BarChart3,       path: '/admin/analytics', badge: null },
  { id: 'firedept',    label: 'Fire Dept',     icon: Shield,          path: '/firedept',        badge: null },
];

export default function Sidebar({ stats, sensorOnline, onLogout }) {
  const { search, setSearch } = useAdmin();
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate  = useNavigate();
  const location  = useLocation();
  const overlayRef = useRef(null);

  const user = JSON.parse(localStorage.getItem('pyrochain_user') || '{}');

  // Auto-open on desktop, closed on mobile
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Simple active logic
  const activeId = NAV_ITEMS.find(i => 
    i.path === location.pathname
  )?.id || 'dashboard';

  // Build badges from live stats
  const getBadge = (id) => {
    if (id === 'alerts' && stats?.critical > 0)    return { text: stats.critical, type: 'danger' };
    if (id === 'sensors' && !sensorOnline)          return { text: '!', type: 'warning' };
    if (id === 'blockchain' && stats?.blockchain > 0) return { text: stats.blockchain, type: 'info' };
    return null;
  };

  const handleNav = (item) => {
    navigate(item.path);
    setMobileOpen(false);
  };

  const isOpen = window.innerWidth >= 768 ? true : mobileOpen;

  return (
    <>
      {/* ── Mobile hamburger button ── */}
      <button
        className="sb-hamburger"
        onClick={() => setMobileOpen(o => !o)}
        aria-label="Open navigation"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          ref={overlayRef}
          className="sb-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''} ${mobileOpen ? 'sidebar--mobile-open' : ''}`}>

        {/* Brand */}
        <div className="sb-brand">
          <div className="sb-brand-mark">PC</div>
          {!collapsed && <span className="sb-brand-name">PyroChain</span>}
          <button
            className="sb-collapse-btn"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Search — expanded only */}
        {!collapsed && (
          <div className="sb-search">
            <Search size={13} className="sb-search-icon" />
            <input
              className="sb-search-input"
              type="text"
              placeholder="Quick search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        )}

        {/* Nav section label */}
        {!collapsed && <div className="sb-section-label">Navigation</div>}

        {/* Nav items */}
        <nav className="sb-nav">
          {NAV_ITEMS.map(item => {
            const Icon  = item.icon;
            const badge = getBadge(item.id);
            const isActive = item.id === activeId;
            return (
              <button
                key={item.id}
                className={`sb-nav-item ${isActive ? 'sb-nav-item--active' : ''}`}
                onClick={() => handleNav(item)}
                title={collapsed ? item.label : ''}
              >
                <span className="sb-nav-icon">
                  <Icon size={16} />
                  {badge && collapsed && (
                    <span className={`sb-badge sb-badge--${badge.type} sb-badge--dot`} />
                  )}
                </span>
                {!collapsed && (
                  <>
                    <span className="sb-nav-label">{item.label}</span>
                    {badge && (
                      <span className={`sb-badge sb-badge--${badge.type}`}>{badge.text}</span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="sb-spacer" />

        {/* Settings link */}
        <button
          className="sb-nav-item sb-settings"
          title={collapsed ? 'Settings' : ''}
        >
          <span className="sb-nav-icon"><Settings size={16} /></span>
          {!collapsed && <span className="sb-nav-label">Settings</span>}
        </button>

        {/* Profile */}
        <div className="sb-profile">
          <div className="sb-avatar">
            {(user.name || user.username || 'A')[0].toUpperCase()}
          </div>
          {!collapsed && (
            <div className="sb-profile-info">
              <span className="sb-profile-name">{user.name || user.username || 'Admin'}</span>
              <span className="sb-profile-role">
                <Circle size={6} className="sb-online-dot" />
                {user.role === 'admin' ? 'Administrator' : 'Fire Dept'}
              </span>
            </div>
          )}
          {!collapsed && (
            <button className="sb-logout-btn" onClick={onLogout} title="Sign out">
              <LogOut size={14} />
            </button>
          )}
          {collapsed && (
            <button className="sb-logout-btn sb-logout-btn--collapsed" onClick={onLogout} title="Sign out">
              <LogOut size={14} />
            </button>
          )}
        </div>

      </aside>
    </>
  );
}
