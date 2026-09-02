import React, { useEffect, useState } from 'react';
import Card from './ui/Card';
import Loading from './ui/Loading';
import Modal from './ui/Modal';
import { ToastContainer } from './ui/Toast';
import { mockSuppliers } from './mockData';

export default function SuppliersPanel({ apiBase }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toasts, setToasts] = useState([]);

  async function fetchSuppliers() {
    try {
      setLoading(true);
      const res = await fetch(`${apiBase}/suppliers?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (Array.isArray(data)) setSuppliers(data);
      else setSuppliers(data.suppliers || data.items || []);
    } catch (err) {
      console.error('fetchSuppliers', err);
      addToast('Error loading suppliers', 'danger');
    } finally { setLoading(false); }
  }

  useEffect(()=>{ fetchSuppliers(); }, [search]);

  function addToast(message, type='info') { const id = Date.now().toString(); setToasts(t => [...t, { id, message, type }]); setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4500); }

  async function handleDelete(id) {
    if (!confirm('Delete this supplier?')) return;
    try {
      const res = await fetch(`${apiBase}/suppliers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      addToast('Supplier deleted', 'success');
      fetchSuppliers();
    } catch (err) { console.error(err); addToast('Delete failed', 'danger'); }
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <h2>Suppliers</h2>
        <div style={{display:'flex',gap:8}}>
          <input placeholder="Search suppliers" value={search} onChange={(e)=>setSearch(e.target.value)} />
        </div>
      </div>
      {loading ? <Card><Loading /></Card> : (
        <Card>
          {((suppliers && suppliers.length) || mockSuppliers.length) === 0 ? <div className="empty-state">No suppliers</div> : (
            <table className="table">
              <thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th></th></tr></thead>
              <tbody>
                {(suppliers && suppliers.length ? suppliers : mockSuppliers).map(s=> (
                  <tr key={s.id}><td>{s.name}</td><td>{s.companyName}</td><td>{s.email}</td><td>{s.phone}</td><td><button className="btn btn-danger btn-small" onClick={()=>handleDelete(s.id)}>Delete</button></td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
      <ToastContainer toasts={toasts} onRemove={(id)=>setToasts(t=>t.filter(x=>x.id!==id))} />
    </div>
  );
}
