import React, { useEffect, useState } from 'react';
import Card from './ui/Card';
import Loading from './ui/Loading';
import { ToastContainer } from './ui/Toast';
import { mockInventory } from './mockData';

export default function InventoryPanel({ apiBase }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toasts, setToasts] = useState([]);

  async function fetchInventory() {
    try {
      setLoading(true);
      const res = await fetch(`${apiBase}/inventory?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (Array.isArray(data)) setItems(data);
      else setItems(data.items || data.inventory || []);
    } catch (err) {
      console.error(err); addToast('Error loading inventory','danger');
    } finally { setLoading(false); }
  }

  useEffect(()=>{ fetchInventory(); }, [search]);
  function addToast(message,type='info'){ const id = Date.now().toString(); setToasts(t=>[...t,{id,message,type}]); setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4500); }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <h2>Inventory</h2>
        <div>
          <input placeholder="Search sku, product" value={search} onChange={(e)=>setSearch(e.target.value)} />
        </div>
      </div>
      {loading ? <Card><Loading /></Card> : (
        <Card>
          {((items && items.length) || mockInventory.length) === 0 ? <div className="empty-state">No inventory items</div> : (
            <table className="table">
              <thead><tr><th>Product</th><th>Warehouse</th><th>Quantity</th><th>Reserved</th><th>Available</th></tr></thead>
              <tbody>{(items && items.length ? items : mockInventory).map(it=> (
                <tr key={it.id}><td>{it.productName || it.productId}</td><td>{it.warehouseId}</td><td>{it.quantity}</td><td>{it.reservedQuantity || 0}</td><td>{(it.quantity||0)-(it.reservedQuantity||0)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>
      )}
      <ToastContainer toasts={toasts} onRemove={(id)=>setToasts(t=>t.filter(x=>x.id!==id))} />
    </div>
  );
}
