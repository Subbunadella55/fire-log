import './PriorityBanner.css';

export default function PriorityBanner({ zone }) {
  if (!zone) return null;

  const temp = parseFloat(zone.temperature).toFixed(1);

  return (
    <div className="priority-banner">
      <div className="priority-badge">TOP PRIORITY</div>
      <div className="priority-info">
        <h3 className="priority-location">{zone.location || zone.deviceId}</h3>
        <span className="priority-detail">
          Device: {zone.deviceId} &nbsp;|&nbsp; Severity: {zone.severity}
        </span>
      </div>
      <div className="priority-temp-block">
        <div className="priority-temp">{temp}°C</div>
        <div className="priority-temp-label">ROOM TEMP (SENSOR)</div>
      </div>
    </div>
  );
}
