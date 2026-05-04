import { useAdmin } from '../../context/AdminContext';
import Sidebar from './Sidebar';
import AlarmOverlay from './AlarmOverlay';
import ToastContainer from './ToastContainer';
import './AdminLayout.css';

export default function AdminLayout({ children, title }) {
  const {
    stats, sensorOnline, logout,
    alarmActive, toasts, removeToast
  } = useAdmin();

  return (
    <div className="admin-shell">
      <Sidebar
        stats={stats}
        sensorOnline={sensorOnline}
        onLogout={logout}
      />

      <div className="admin-content">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <span className="admin-topbar-title">{title || 'Admin Dashboard'}</span>
          </div>
          <div className="admin-topbar-right">
            <div className={`topbar-sensor ${sensorOnline ? 'online' : 'offline'}`}>
              <span className="topbar-sensor-dot" />
              {sensorOnline ? 'Sensor Online' : 'Sensor Offline'}
            </div>
          </div>
        </header>

        <main className="admin-main">
          <div className="admin-layout">
            <AlarmOverlay active={alarmActive} />
            <ToastContainer toasts={toasts} onRemove={removeToast} />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
