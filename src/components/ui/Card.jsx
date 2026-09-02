import React from 'react';
import './ui.css';

export default function Card({ title, children, className='' }) {
  return (
    <div className={`card ${className}`}>
      {title && <div className="card-title">{title}</div>}
      <div>{children}</div>
    </div>
  );
}
