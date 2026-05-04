import './AlarmOverlay.css';

export default function AlarmOverlay({ active }) {
  if (!active) return null;
  return (
    <div className="alarm-overlay">
      <div className="alarm-content">
        <div className="alarm-title">CRITICAL FIRE ALERT</div>
        <div className="alarm-sub">Immediate action required</div>
      </div>
    </div>
  );
}
