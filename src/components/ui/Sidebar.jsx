import React from 'react';
import './ui.css';

export default function Sidebar({ items = [], activeId, onNavigate }) {
  return (
    <aside className="ui-sidebar">
      <div className="brand">
        <div style={{width:40,height:40,background:'#fff',borderRadius:8}}></div>
        <h2>RV Logistics</h2>
      </div>
      <nav>
        <ul className="ui-nav-list">
          {items.map((it) => (
            <li key={it.id} className={`ui-nav-item ${activeId === it.id ? 'active' : ''}`} onClick={() => onNavigate && onNavigate(it.id)}>
              <span style={{width:20,display:'inline-block'}}>{it.icon || '📦'}</span>
              <span>{it.label}</span>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
