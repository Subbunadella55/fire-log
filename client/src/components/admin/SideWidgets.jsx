import './SideWidgets.css';

/* ── Zone Priority List ── */
export function ZoneList({ zones }) {
  const SEV_COLOR = {
    CRITICAL: '#ff3b30', HIGH: '#ff9500', MEDIUM: '#ffcc00', LOW: '#34c759',
  };

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <span className="chart-title">Zone Priority</span>
        <span className="chart-sub">{zones.length} zones</span>
      </div>
      <div className="zone-list">
        {zones.length === 0 ? (
          <div className="zone-empty">No active zones</div>
        ) : (
          zones.slice(0, 6).map((z, i) => (
            <div className="zone-item" key={z.deviceId + i}>
              <div className="zone-rank">{i + 1}</div>
              <div className="zone-body">
                <div className="zone-name">{z.location || 'Unknown'}</div>
                <div className="zone-device">{z.deviceId}</div>
              </div>
              <div
                className="zone-temp"
                style={{ color: SEV_COLOR[z.severity] || '#a0a0a0' }}
              >
                {parseFloat(z.temperature).toFixed(0)}°
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Blockchain Queue ── */
export function BlockchainQueue({ queue }) {
  const SEV_CLS = {
    CRITICAL: 'bc--critical', HIGH: 'bc--high', MEDIUM: 'bc--medium', LOW: 'bc--low',
  };

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <span className="chart-title">Blockchain Queue</span>
        <span className="chart-sub">{queue.length} entries</span>
      </div>
      <div className="bc-queue">
        {queue.length === 0 ? (
          <div className="zone-empty">Awaiting transactions…</div>
        ) : (
          queue.map(item => (
            <div className={`bc-item ${SEV_CLS[item.severity] || ''}`} key={item.id}>
              <span className="bc-sev">{item.severity || 'LOG'}</span>
              <span className="bc-hash">{item.txHash?.substring(0, 24)}…</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
