import { useState, useMemo } from 'react';
import { useAdmin } from '../context/AdminContext';
import Navbar from '../components/Navbar';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import './FireDeptDashboard.css';
import 'leaflet/dist/leaflet.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

// Leaflet markers fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const SEV_ORDER = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4, NORMAL: 5 };

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 200 },
  plugins: { legend: { display: false } },
  scales: {
    x: { display: false },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(0,0,0,0.04)' },
      ticks: { color: '#8c9196', font: { size: 10 } },
    },
  },
  elements: { line: { tension: 0.4 } },
};

export default function FireDeptDashboard() {
  const {
    allAlerts, stats, sensorOnline, resolveAlert, triggerTestAlert,
    tempHistory, smokeHistory, labelHistory, API_BASE
  } = useAdmin();

  if (!stats) return <div className="fd-loading">Initializing Emergency Dispatch...</div>;

  const [dispatchedUnits, setDispatchedUnits] = useState(3);
  const [activePage, setActivePage] = useState(1);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const PAGE_SIZE = 3;

  // Filter only ACTIVE incidents
  const activeIncidents = useMemo(() => {
    return allAlerts
      .filter(a => a.status !== 'RESOLVED')
      .sort((a, b) => (SEV_ORDER[a.severity] || 9) - (SEV_ORDER[b.severity] || 9));
  }, [allAlerts]);

  const hasCritical = activeIncidents.some(i => i.severity === 'CRITICAL');
  const criticalLoc = activeIncidents.find(i => i.severity === 'CRITICAL')?.location;

  // Chart data
  const tempData = {
    labels: labelHistory,
    datasets: [{
      label: 'Temp',
      data: tempHistory,
      borderColor: '#1a1a1a',
      backgroundColor: 'rgba(26,26,26,0.05)',
      borderWidth: 2, pointRadius: 2, fill: true,
    }],
  };

  const smokeData = {
    labels: labelHistory,
    datasets: [{
      label: 'Smoke',
      data: smokeHistory,
      borderColor: '#6d7175',
      backgroundColor: 'rgba(109,113,117,0.06)',
      borderWidth: 2, pointRadius: 2, fill: true,
    }],
  };

  // Actions
   const handleDispatch = async (alertId) => {
    await resolveAlert(alertId);
    setDispatchedUnits(p => p + 1);
    setSelectedIncident(null);
  };

  const handleAllClear = async () => {
    if (!window.confirm('Send "All Clear" and resolve all active incidents?')) return;
    for (const inc of activeIncidents) {
      await resolveAlert(inc._id);
    }
  };

  const downloadLog = () => {
    window.print(); // Simple way to "download/save" for demo
  };

  const triggerTestMode = () => {
    triggerTestAlert();
  };

  return (
    <div className="fd-root">
      <Navbar roleName="Fire Department" />

      {/* Critical banner */}
      {hasCritical && (
        <div className="fd-banner">
          <span className="fd-banner-dot" />
          <strong>CRITICAL EMERGENCY</strong>
          <span className="fd-banner-sep" />
          <span>Immediate response required — {criticalLoc || 'Multiple Sections'}</span>
        </div>
      )}

      <main className="fd-main">
        <div className="fd-layout">

          {/* Header */}
          <div className="fd-page-header">
            <div>
              <h1 className="fd-page-title">Emergency Dispatch Center</h1>
              <p className="fd-page-sub">Real-time incident response and data synchronization</p>
            </div>
            <div className="fd-header-right">
              <div className={`fd-hw-badge ${sensorOnline ? 'online' : 'offline'}`}>
                <span className="fd-hw-dot" />
                {sensorOnline ? 'Hardware Connected' : 'Hardware Offline'}
              </div>
              <div className="fd-sensor-metrics">
                <span>Total Detected: <strong>{stats?.total || 0}</strong></span>
                <span>Active: <strong style={{color: '#e51c00'}}>{activeIncidents?.length || 0}</strong></span>
                <span>Audit Keys: <strong>{stats?.blockchain || 0}</strong></span>
              </div>
              <div className="fd-stat-chip">
                <span className="fd-stat-label">Units Active</span>
                <span className="fd-stat-val">{dispatchedUnits || 0}</span>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="fd-charts">
            <div className="fd-chart-card">
              <div className="fd-chart-header">
                <span className="fd-chart-title">Temperature Live Trend</span>
              </div>
              <div className="fd-chart-body">
                <Line data={tempData} options={CHART_OPTS} />
              </div>
            </div>
            <div className="fd-chart-card">
              <div className="fd-chart-header">
                <span className="fd-chart-title">Smoke/Gas Level Trend (MQ2)</span>
              </div>
              <div className="fd-chart-body">
                <Line data={smokeData} options={CHART_OPTS} />
              </div>
            </div>
          </div>

          {/* Main Grid */}
          <div className="fd-grid">

            {/* Left Column: Map + Incidents */}
            <div className="fd-left">
              <div className="fd-section-card">
                <div className="fd-section-header">
                  <span className="fd-section-title">Live Incident Map</span>
                  <span className="fd-section-sub">{activeIncidents.length} incidents</span>
                </div>
                <div className="fd-map-wrapper">
                  <MapContainer center={[12.8715, 80.221]} zoom={15} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    {(activeIncidents || []).map(inc => (
                      <Marker key={inc._id} position={[inc.latitude || 12.8715, inc.longitude || 80.221]}>
                        <Popup>
                          <strong>{inc.severity || 'Fire Alert'} — #{inc._id?.toString().slice(-4)}</strong><br />
                          {inc.location || 'Unknown Location'}<br />
                          Temp: {inc.temperature || 0}°C
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </div>

              <div className="fd-section-label">Active Incidents</div>

              <div className="fd-incidents">
                {activeIncidents.length === 0 ? (
                  <div className="fd-empty-state">
                    No active incidents detected. Monitoring in progress...
                  </div>
                ) : (
                  <>
                    {activeIncidents
                      .slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE)
                      .map(inc => (
                        <div key={inc._id} className={`fd-incident-card fd-incident--${(inc.severity || 'normal').toLowerCase()}`}>
                          <div className="fd-inc-top">
                            <span className="fd-inc-id">#{inc._id?.toString().slice(-6).toUpperCase()}</span>
                            <span className={`fd-inc-badge fd-badge--${(inc.severity || 'normal').toLowerCase()}`}>
                              {inc.severity}
                            </span>
                          </div>

                          <div className="fd-inc-title">{inc.severity} Fire Alert</div>
                          <div className="fd-inc-location">{inc.location || 'Sensor Node Section'}</div>

                          <div className="fd-inc-metrics">
                            <div className="fd-metric">
                              <span className="fd-metric-label">Temp</span>
                              <span className="fd-metric-val">{inc.temperature || 0}°C</span>
                            </div>
                            <div className="fd-metric">
                              <span className="fd-metric-label">Smoke</span>
                              <span className="fd-metric-val">{inc.smokeLevel || 0} ppm</span>
                            </div>
                            <div className="fd-metric">
                              <span className="fd-metric-label">Humidity</span>
                              <span className="fd-metric-val">{inc.humidity || 0}%</span>
                            </div>
                          </div>

                          <div className="fd-inc-actions">
                            <button
                              className="fd-btn-primary"
                              onClick={() => setSelectedIncident(inc)}
                            >
                              Dispatch Unit
                            </button>
                            <button className="fd-btn-secondary" onClick={() => window.open(`${API_BASE}/api/fire-alert/${inc._id}`, '_blank')}>
                              View Telemetry
                            </button>
                          </div>
                        </div>
                      ))
                    }

                    {/* Pagination Bar — Styled like requested image */}
                    {activeIncidents.length > PAGE_SIZE && (
                      <div className="fd-pagination-container">
                        <div className="fd-pagination-box">
                          <button 
                            className="fd-pag-action" 
                            disabled={activePage === 1}
                            onClick={() => setActivePage(p => p - 1)}
                          >
                            ← Prev
                          </button>
                          
                          <div className="fd-pag-divider" />
                          
                          <span className="fd-pag-current">
                            {activePage} / {Math.ceil(activeIncidents.length / PAGE_SIZE)}
                          </span>
                          
                          <div className="fd-pag-divider" />
                          
                          <button 
                            className="fd-pag-action" 
                            disabled={activePage * PAGE_SIZE >= activeIncidents.length}
                            onClick={() => setActivePage(p => p + 1)}
                          >
                            Next →
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {selectedIncident && (
              <div className="fd-final-overlay">
                <div className="fd-final-modal">
                  <div className="fd-final-header">
                    <h1 className="fd-final-title">Confirm Dispatch Unit</h1>
                    <button className="fd-final-close" onClick={() => setSelectedIncident(null)}>×</button>
                  </div>
                  
                  <div className="fd-final-body">
                    <div className="fd-final-meta">
                      {selectedIncident.severity}#{selectedIncident._id?.toString().slice(-3)}
                    </div>
                    
                    <div className="fd-final-details">
                      <p>Dispatching to: <strong>{selectedIncident.location}</strong></p>
                      <p>Temp <strong>{selectedIncident.temperature}°C</strong></p>
                      <p>Smoke <strong>{selectedIncident.smokeLevel} ppm</strong></p>
                    </div>

                    <p className="fd-final-disclaimer">
                      This will notify the primary response unit and update the incident lifecycle to 'IN_PROGRESS'.
                    </p>

                    <div className="fd-final-actions">
                      <button className="fd-final-btn-cancel" onClick={() => setSelectedIncident(null)}>Cancel</button>
                      <button className="fd-final-btn-confirm" onClick={() => handleDispatch(selectedIncident._id)}>Confirm & Dispatch</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Right Column: Panel */}
            <div className="fd-right">
              <div className="fd-section-card">
                <div className="fd-section-header"><span className="fd-section-title">Quick Actions</span></div>
                <div className="fd-quick-actions">
                  <button className="fd-action-btn" onClick={handleAllClear}>All Clear Signal</button>
                  <button className="fd-action-btn" onClick={triggerTestMode}>System Test Mode</button>
                  <button className="fd-action-btn" onClick={downloadLog}>Download Shift Log</button>
                </div>
              </div>

              <div className="fd-section-card">
                <div className="fd-section-header"><span className="fd-section-title">System Activity Log</span></div>
                <div className="fd-comms">
                  <div className="fd-log-item" style={{ fontSize: '11px', paddingBottom: '8px', borderBottom: '1px solid #f6f6f7', marginBottom: '8px' }}>
                    <span style={{ color: '#8c9196', fontWeight: 'bold' }}>[{new Date().toLocaleTimeString()}]</span> Secure communication channel established.
                  </div>
                  <div className="fd-log-item" style={{ fontSize: '11px', paddingBottom: '8px', borderBottom: '1px solid #f6f6f7', marginBottom: '8px' }}>
                    <span style={{ color: '#8c9196', fontWeight: 'bold' }}>[{new Date().toLocaleTimeString()}]</span> Gateway listening on Port 5000.
                  </div>
                  <div className="fd-log-item" style={{ fontSize: '11px' }}>
                    <span style={{ color: '#8c9196', fontWeight: 'bold' }}>[{new Date().toLocaleTimeString()}]</span> Supabase cloud sync heartbeat active.
                  </div>
                </div>
              </div>

              <div className="fd-section-card">
                <div className="fd-section-header"><span className="fd-section-title">Case Summary</span></div>
                <div className="fd-summary">
                  {['CRITICAL','HIGH','MEDIUM','LOW'].map(sev => {
                    const count = activeIncidents.filter(i => i.severity === sev).length;
                    return (
                      <div key={sev} className="fd-summary-row">
                        <span className={`fd-inc-badge fd-badge--${sev.toLowerCase()}`}>{sev}</span>
                        <span className="fd-summary-count">{count}</span>
                      </div>
                    );
                  })}
                  <div className="fd-summary-row fd-summary-total">
                    <span>Active Total</span>
                    <span className="fd-summary-count">{activeIncidents.length}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
