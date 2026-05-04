import './StatCards.css';

const CARD_CONFIG = [
  { key: 'critical',   label: 'Critical Alerts',       sub: 'Active Now',        color: '#e51c00' },
  { key: 'active',     label: 'Active Sensor Alerts',  sub: 'Fire Sensor Active', color: '#e07d10' },
  { key: 'blockchain', label: 'Blockchain Logs',        sub: 'Verified On-Chain', color: '#1a1a1a' },
  { key: 'total',      label: 'Total Logged',           sub: 'All Time',          color: '#1a1a1a' },
];

export default function StatCards({ stats }) {
  return (
    <div className="stat-grid">
      {CARD_CONFIG.map(c => (
        <div
          key={c.key}
          className="stat-card"
          style={{ '--card-accent': c.color }}
        >
          <div className="stat-label">{c.label}</div>
          <div className="stat-value" style={{ color: c.color }}>{stats[c.key] ?? 0}</div>
          <div className="stat-sub">{c.sub}</div>
          <div className="stat-bar" style={{ background: c.color }} />
        </div>
      ))}
    </div>
  );
}
