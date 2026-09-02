import React from 'react';
import './ui.css';

export default function Modal({ open, title, children, onClose, actions }) {
  if (!open) return null;
  return (
    <div className="ui-modal-backdrop" onClick={onClose}>
      <div className="ui-modal" onClick={(e) => e.stopPropagation()}>
        {title && <h3 style={{margin:0}}>{title}</h3>}
        <div style={{marginTop:12}}>{children}</div>
        <div className="modal-actions">
          {actions}
        </div>
      </div>
    </div>
  );
}
