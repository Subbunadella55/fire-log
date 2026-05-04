import './SupabaseLedger.css';

export default function SupabaseLedger({ alerts }) {
  return (
    <div className="ledger-card">
      <div className="ledger-header">
        <h3 className="ledger-title">Backend Data Ledger (Sync with Supabase)</h3>
        <p className="ledger-subtitle">Raw audit of all captured telemetry fields and lifecycle states.</p>
      </div>
      
      <div className="ledger-scroll">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>ID Path</th>
              <th>Device / Location</th>
              <th>Telemetry (T/S/H)</th>
              <th>Geospatial (Lat/Long)</th>
              <th>Classification</th>
              <th>Blockchain / Integrity</th>
              <th>Lifecycle Status</th>
              <th>System Flags</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map(a => (
              <tr key={a._id}>
                <td className="l-mono">...{a._id?.toString().slice(-6) || 'N/A'}</td>
                <td>
                  <div className="l-main">{a.location}</div>
                  <div className="l-sub">{a.deviceId}</div>
                </td>
                <td>
                  <div className="l-stat">T: {a.temperature}°C</div>
                  <div className="l-stat">S: {a.smokeLevel} ppm</div>
                  <div className="l-stat">H: {a.humidity}%</div>
                </td>
                <td className="l-mono">
                  {(a.latitude || 0).toFixed(4)}, {(a.longitude || 0).toFixed(4)}
                </td>
                <td>
                  <div className={`l-badge l-sev--${(a.severity || 'normal').toLowerCase()}`}>{a.severity || 'NORMAL'}</div>
                  <div className="l-sub">Score: {a.severityScore || 0}%</div>
                </td>
                <td>
                  {a.blockchainTxHash ? (
                    <>
                      <div className="l-tx" title={a.blockchainTxHash}>
                        {a.blockchainTxHash.slice(0, 10)}...
                      </div>
                      <div className="l-sub">Verified: {a.blockchainVerified ? 'YES' : 'NO'}</div>
                    </>
                  ) : (
                    <span className="l-pending">Queuing...</span>
                  )}
                </td>
                <td>
                  <div className={`l-status l-status--${(a.status || 'pending').toLowerCase()}`}>{a.status || 'PENDING'}</div>
                  <div className="l-sub">{(a.dispatchStatus || 'NOT_DISPATCHED').replace('_', ' ')}</div>
                </td>
                <td>
                  <div className="l-flags">
                    <span className={a.emailSent ? 'on' : ''}>📧</span>
                    <span className={a.smsSent ? 'on' : ''}>📱</span>
                    <span className={a.alertActive ? 'on' : ''}>🔔</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
