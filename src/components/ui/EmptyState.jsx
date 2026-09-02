import React from 'react';
import './ui.css';

export default function EmptyState({ title='Nothing here', message='No items to display.' }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">📭</div>
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-text">{message}</div>
    </div>
  );
}
