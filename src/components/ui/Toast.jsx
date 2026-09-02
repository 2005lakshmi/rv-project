import React, { useEffect } from 'react';
import './ui.css';

export function Toast({ message, type='info', onClose }) {
  useEffect(() => {
    const t = setTimeout(() => onClose && onClose(), 4000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="ui-toast">
      <strong style={{display:'block'}}>{type.toUpperCase()}</strong>
      <div>{message}</div>
    </div>
  );
}

export function ToastContainer({ toasts = [], onRemove }) {
  return (
    <div className="ui-toast-container">
      {toasts.map((t) => (
        <Toast key={t.id} {...t} onClose={() => onRemove && onRemove(t.id)} />
      ))}
    </div>
  );
}
