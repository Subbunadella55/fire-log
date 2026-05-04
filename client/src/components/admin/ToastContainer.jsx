import './ToastContainer.css';

export default function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast--${t.type}`}
          onClick={() => onRemove(t.id)}
          role="alert"
        >
          <span className="toast-dot" />
          <div className="toast-content">
            <div className="toast-title">{t.title}</div>
            {t.body && <div className="toast-body">{t.body}</div>}
          </div>
          <button className="toast-close" onClick={() => onRemove(t.id)}>x</button>
          <div className="toast-progress" />
        </div>
      ))}
    </div>
  );
}
