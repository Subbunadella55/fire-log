import './AlertTable.css';

const SEV_COLORS = {
  critical: '#ff3b30', high: '#ff9500', medium: '#ffcc00', low: '#34c759', normal: '#8e8e93',
};

function SeverityBadge({ severity }) {
  const sev = (severity || 'NORMAL').toLowerCase();
  return (
    <span className={`sev-badge sev-badge--${sev}`}>{severity}</span>
  );
}

function StatusBadge({ status }) {
  const cls = status === 'RESOLVED' || status === 'FALSE_ALARM' ? 'resolved' : 'pending';
  return (
    <span className={`status-badge status-badge--${cls}`}>{status || 'PENDING'}</span>
  );
}

export default function AlertTable({
  alerts, currentPage, totalPages, totalCount,
  currentFilter, onFilterChange, onPageChange, onResolve,
}) {
  const FILTERS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const start = (currentPage - 1) * 15;

  return (
    <div className="alert-table-card">
      {/* Header bar */}
      <div className="at-header">
        <div className="at-title">
          <span className="at-title-dot" />
          Real-Time Alert Log
        </div>
        <div className="at-controls">
          <div className="filter-group">
            {FILTERS.map(f => (
              <button
                key={f}
                className={`filter-btn filter-btn--${f.toLowerCase()} ${currentFilter === f ? 'active' : ''}`}
                onClick={() => onFilterChange(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <a
            href="http://localhost:5000/api/report/pdf"
            className="pdf-btn"
            target="_blank"
            rel="noreferrer"
          >
            ↓ PDF Report
          </a>
        </div>
      </div>

      {/* Table */}
      <div className="at-scroll">
        <table className="at-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Device ID</th>
              <th>Room Temp °C</th>
              <th>Smoke (MQ2)</th>
              <th>Humidity %</th>
              <th>Location</th>
              <th>Severity</th>
              <th>Status</th>
              <th>BC TX Hash</th>
              <th>Time</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={11} className="at-empty">
                  <div className="at-empty-icon">🔍</div>
                  <div>
                    {currentFilter !== 'ALL'
                      ? `No ${currentFilter} alerts found`
                      : 'Monitoring for fire alerts...'}
                  </div>
                  <div className="at-empty-sub">Real-time data will appear here</div>
                </td>
              </tr>
            ) : (
              alerts.map((a, idx) => {
                const sev = (a.severity || 'NORMAL').toLowerCase();
                const resolved = a.status === 'RESOLVED' || a.status === 'FALSE_ALARM';
                const isPrio = idx === 0 && currentPage === 1 && a.severity === 'CRITICAL';
                const txShort = a.blockchainTxHash
                  ? a.blockchainTxHash.substring(0, 12) + '…'
                  : null;
                const time = new Date(a.createdAt || a.sensorTimestamp).toLocaleString();

                const tempVal = parseFloat(a.temperature || 0).toFixed(1);
                const tempClass = sev === 'critical' ? 'temp--critical'
                  : sev === 'high' ? 'temp--high'
                  : sev === 'medium' ? 'temp--medium'
                  : 'temp--low';

                return (
                  <tr
                    key={a._id}
                    className={`${isPrio ? 'row--priority' : ''} ${idx === 0 && currentPage === 1 ? 'row--flash' : ''}`}
                    data-id={a._id}
                  >
                    <td className="cell--idx">{start + idx + 1}</td>
                    <td><span className="device-id">{a.deviceId || '—'}</span></td>
                    <td><span className={`temp-cell ${tempClass}`}>{tempVal}°</span></td>
                    <td className="cell--mono">{a.smokeLevel || 0}</td>
                    <td className="cell--mono">{parseFloat(a.humidity || 0).toFixed(0)}%</td>
                    <td className="cell--location" title={a.location}>{a.location || '—'}</td>
                    <td><SeverityBadge severity={a.severity} /></td>
                    <td><StatusBadge status={a.status} /></td>
                    <td>
                      {txShort
                        ? <span className="tx-hash" title={a.blockchainTxHash}>{txShort}</span>
                        : <span className="tx-pending">Pending…</span>
                      }
                    </td>
                    <td className="cell--time">{time}</td>
                    <td>
                      <button
                        className={`btn-resolve ${resolved ? 'resolved' : ''}`}
                        onClick={() => !resolved && onResolve(a._id)}
                        disabled={resolved}
                      >
                        {resolved ? '✓' : 'Resolve'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer pagination */}
      <div className="at-footer">
        <span className="at-count">
          {totalCount} record{totalCount !== 1 ? 's' : ''}
        </span>
        <div className="at-pagination">
          <button
            className="page-btn"
            onClick={() => onPageChange(-1)}
            disabled={currentPage <= 1}
          >← Prev</button>
          <span className="page-indicator">{currentPage} / {Math.max(1, totalPages)}</span>
          <button
            className="page-btn"
            onClick={() => onPageChange(1)}
            disabled={currentPage >= totalPages}
          >Next →</button>
        </div>
      </div>
    </div>
  );
}
