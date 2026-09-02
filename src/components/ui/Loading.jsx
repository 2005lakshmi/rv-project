import React from 'react';
import './ui.css';

export default function Loading({ size = 48, message = 'Loading...' }) {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
      <div className="spinner" style={{width:size,height:size}}></div>
      <div style={{color:'var(--text-secondary)'}}>{message}</div>
    </div>
  );
}
