import React, { useEffect, useState } from 'react';
import Card from './ui/Card';
import Loading from './ui/Loading';
import Modal from './ui/Modal';
import { ToastContainer } from './ui/Toast';
import { mockProducts } from './mockData';

export default function ProductsPanel({ apiBase }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [toasts, setToasts] = useState([]);

  async function fetchProducts() {
    try {
      setLoading(true);
      const qs = new URLSearchParams({ page, limit, search });
      const res = await fetch(`${apiBase}/products?${qs.toString()}`);
      const data = await res.json();
      // data may be { total, products } or array
      if (Array.isArray(data)) setProducts(data);
      else setProducts(data.products || data.items || []);
    } catch (err) {
      console.error('fetchProducts', err);
      addToast('Error loading products', 'danger');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchProducts(); }, [page, search]);

  function addToast(message, type='info') {
    const id = Date.now().toString();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this product?')) return;
    try {
      const res = await fetch(`${apiBase}/products/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      addToast('Product deleted', 'success');
      fetchProducts();
    } catch (err) {
      console.error(err);
      addToast('Delete failed', 'danger');
    }
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <h2>Products</h2>
        <div style={{display:'flex',gap:8}}>
          <input placeholder="Search SKU or name" value={search} onChange={(e)=>setSearch(e.target.value)} />
          <button className="btn btn-primary" onClick={()=>setShowCreate(true)}>Create</button>
        </div>
      </div>

      {loading ? <Card><Loading /></Card> : (
        <Card>
          {((products && products.length) || mockProducts.length) === 0 ? <div className="empty-state">No products</div> : (
            <table className="table">
              <thead>
                <tr><th>SKU</th><th>Name</th><th>Category</th><th>Price</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {(products && products.length ? products : mockProducts).map(p => (
                  <tr key={p.id}>
                    <td>{p.sku}</td>
                    <td>{p.name}</td>
                    <td>{p.category}</td>
                    <td>{p.price}</td>
                    <td>{p.status}</td>
                    <td><button className="btn btn-danger btn-small" onClick={()=>handleDelete(p.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <Modal open={showCreate} title="Create Product" onClose={()=>setShowCreate(false)} actions={<>
        <button className="btn btn-secondary" onClick={()=>setShowCreate(false)}>Cancel</button>
      </>}>
        <p>Product creation form is not implemented yet.</p>
      </Modal>

      <ToastContainer toasts={toasts} onRemove={(id)=>setToasts(t=>t.filter(x=>x.id!==id))} />
    </div>
  );
}
