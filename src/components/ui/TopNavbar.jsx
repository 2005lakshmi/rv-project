import React from 'react';
import './ui.css';

export default function TopNavbar({ onSearch, rightContent }) {
  return (
    <div className="ui-topnav">
      <div className="left">
        <div style={{fontWeight:700, color:'#0b2a4a'}}>Admin Console</div>
        <div className="search">
          <input placeholder="Search products, suppliers, warehouses..." onChange={(e) => onSearch && onSearch(e.target.value)} />
        </div>
      </div>
      <div className="right">{rightContent}</div>
    </div>
  );
}
