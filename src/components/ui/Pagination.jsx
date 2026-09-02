import React from 'react';
import './ui.css';

export default function Pagination({ page=1, total=1, onChange }) {
  const pages = [];
  for (let i=1;i<=total;i++) pages.push(i);
  return (
    <div className="ui-pagination">
      {pages.map(p => (
        <button key={p} className={`ui-page ${p===page?'active':''}`} onClick={() => onChange && onChange(p)}>{p}</button>
      ))}
    </div>
  );
}
