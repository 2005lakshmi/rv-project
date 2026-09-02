import { useEffect, useState } from 'react';
import api from '../services/api';
import Sidebar from './ui/Sidebar';
import TopNavbar from './ui/TopNavbar';
import Loading from './ui/Loading';
import EmptyState from './ui/EmptyState';
import Card from './ui/Card';
import './ui/ui.css';
import WarehousesPanel from './WarehousesPanel';
import OrdersPanel from './OrdersPanel';
import ForecastPanel from './ForecastPanel';
import DisruptionPanel from './DisruptionPanel';
import KPIMetrics from './KPIMetrics';
import AlertsPanel from './AlertsPanel';
import AIInsightsPanel from './AIInsightsPanel';
import GMap from './gmap';
import ProductsPanel from './ProductsPanel';
import SuppliersPanel from './SuppliersPanel';
import InventoryPanel from './InventoryPanel';

function WarehouseBarChart({ data = [] }) {
  if (!Array.isArray(data) || data.length === 0) return <div>No data</div>;
  const max = Math.max(...data.map(d => d.totalAvailable || d.totalQuantity || 0), 1);
  return (
    <svg width="100%" height="120" viewBox={`0 0 ${data.length * 60} 120`} preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const value = d.totalAvailable || d.totalQuantity || 0;
        const h = Math.round((value / max) * 80);
        return (
          <g key={d._id} transform={`translate(${i * 60 + 10},0)`}> 
            <rect x={0} y={100 - h} width={40} height={h} fill="#4f46e5" />
            <text x={20} y={115} fontSize={10} textAnchor="middle">{String(d._id).slice(0,8)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function CategoryBarChart({ data = [] }) {
  if (!Array.isArray(data) || data.length === 0) return <div>No data</div>;
  const max = Math.max(...data.map(d => d.count || 0), 1);
  return (
    <svg width="100%" height="120" viewBox={`0 0 ${data.length * 60} 120`} preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const value = d.count || 0;
        const h = Math.round((value / max) * 80);
        return (
          <g key={d._id} transform={`translate(${i * 60 + 10},0)`}> 
            <rect x={0} y={100 - h} width={40} height={h} fill="#059669" />
            <text x={20} y={115} fontSize={10} textAnchor="middle">{(d._id || 'N/A').slice(0,8)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ data = [] }) {
  // data: [{ _id: 'YYYY-MM-DD', total: <number>, types: [...] }, ...]
  if (!Array.isArray(data) || data.length === 0) return <div>No data</div>;
  const points = data.map((d, i) => ({ x: i, y: d.total || 0, label: d._id }));
  const max = Math.max(...points.map(p => p.y), 1);
  const width = Math.max(points.length * 20, 200);
  const height = 120;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * 20 + 10} ${height - 20 - (p.y / max) * 80}`).join(' ');
  return (
    <svg width="100%" height="120" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
      <path d={path} stroke="#ef4444" strokeWidth={2} fill="none" />
      {points.map((p, i) => (
        <circle key={i} cx={i * 20 + 10} cy={height - 20 - (p.y / max) * 80} r={3} fill="#ef4444" />
      ))}
    </svg>
  );
}

function AdminDashboard({ onLogout, onOpenLogistics }) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSuppliers: 0,
    totalProducts: 0,
    totalWarehouses: 0,
    totalInventory: 0,
    lowStockProducts: 0,
  });
  const [charts, setCharts] = useState({ inventoryByWarehouse: [], productsByCategory: [], inventoryMovementOverTime: [] });
  const [recent, setRecent] = useState({ inventoryTransactions: [], products: [], suppliers: [], transfers: [] });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('dashboard');
  const API_BASE = 'http://localhost:3000/api';

  async function loadDashboard() {
    try {
      setLoading(true);
      const statsResponse = await api.get('/admin/dashboard/stats');
      const payload = statsResponse.data.data || {};
      setStats({
        totalUsers: payload.totalUsers || 0,
        totalSuppliers: payload.totalSuppliers || 0,
        totalProducts: payload.totalProducts || 0,
        totalWarehouses: payload.totalWarehouses || 0,
        totalInventory: payload.totalInventory || 0,
        lowStockProducts: payload.lowStockProducts || 0,
      });

      setCharts({
        inventoryByWarehouse: payload.inventoryByWarehouse || [],
        productsByCategory: payload.productsByCategory || [],
        inventoryMovementOverTime: payload.inventoryMovementOverTime || []
      });

      setRecent({
        inventoryTransactions: payload.recentInventoryTransactions || [],
        products: payload.recentProducts || [],
        suppliers: payload.recentSuppliers || [],
        transfers: payload.recentTransfers || []
      });

      // users list not required here; keep users unchanged
    } catch (error) {
      console.error('Unable to load admin dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <div className="app-container admin-shell">
      <TopNavbar
        onSearch={(q) => console.log('search', q)}
        rightContent={<>
          <button className="btn btn-secondary" onClick={onOpenLogistics}>Open Logistics</button>
          <button className="btn btn-primary" onClick={onLogout}>Logout</button>
        </>}
      />

      <div style={{display:'flex', alignItems:'stretch', gap:20}}>
        <Sidebar items={[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'warehouses', label: 'Warehouses' },
          { id: 'orders', label: 'Orders' },
          { id: 'forecast', label: 'Forecast' },
          { id: 'inventory', label: 'Inventory' },
          { id: 'products', label: 'Products' },
          { id: 'suppliers', label: 'Suppliers' },
          { id: 'map', label: 'Map' },
          { id: 'kpis', label: 'KPIs' },
          { id: 'ai', label: 'AI' },
          { id: 'alerts', label: 'Alerts' }
        ]} onNavigate={(id) => setActiveSection(id)} activeId={activeSection} />

        <main className="app-main" style={{flex:1}}>
          {loading ? (
            <div className="card admin-card loading-card"><Loading message="Loading admin dashboard..." /></div>
          ) : (
            <>
              {activeSection === 'dashboard' && (
                <>
                  <section className="admin-overview">
            <div className="metric-card card">
              <span>Total Users</span>
              <strong>{stats.totalUsers}</strong>
            </div>
            <div className="metric-card card">
              <span>Warehouses</span>
              <strong>{stats.totalWarehouses}</strong>
            </div>
            <div className="metric-card card">
              <span>Products</span>
              <strong>{stats.totalProducts}</strong>
            </div>
            <div className="metric-card card">
              <span>Inventory Units</span>
              <strong>{stats.totalInventory}</strong>
            </div>
            <div className="metric-card card">
              <span>Suppliers</span>
              <strong>{stats.totalSuppliers}</strong>
            </div>
            <div className="metric-card card">
              <span>Low Stock</span>
              <strong>{stats.lowStockProducts}</strong>
            </div>
          </section>

          <section className="admin-charts">
            <div className="card chart-card">
              <h4>Inventory by Warehouse</h4>
              <WarehouseBarChart data={charts.inventoryByWarehouse} />
            </div>

            <div className="card chart-card">
              <h4>Products by Category</h4>
              <CategoryBarChart data={charts.productsByCategory} />
            </div>

            <div className="card chart-card">
              <h4>Inventory Movement (30 days)</h4>
              <LineChart data={charts.inventoryMovementOverTime} />
            </div>
          </section>

          <section className="admin-recent">
            <div className="card">
              <h3>Recent Inventory Transactions</h3>
              <ul>
                {recent.inventoryTransactions.map((t) => (
                  <li key={t.id}>{t.type} · {t.quantity} · {t.inventoryId} · {new Date(t.createdAt).toLocaleString()}</li>
                ))}
              </ul>
            </div>

            <div className="card">
              <h3>Recent Products</h3>
              <ul>
                {recent.products.map((p) => (
                  <li key={p.id}>{p.name} · {p.sku} · {p.category}</li>
                ))}
              </ul>
            </div>

            <div className="card">
              <h3>Recent Suppliers</h3>
              <ul>
                {recent.suppliers.map((s) => (
                  <li key={s.id}>{s.name} · {s.companyName || ''} · {s.email}</li>
                ))}
              </ul>
            </div>

            <div className="card">
              <h3>Recent Stock Transfers</h3>
              <ul>
                {recent.transfers.map((tr) => (
                  <li key={tr.id}>{tr.productId} · {tr.quantity} · {tr.sourceWarehouseId} → {tr.destinationWarehouseId} · {new Date(tr.createdAt).toLocaleString()}</li>
                ))}
              </ul>
            </div>
          </section>
              <section className="admin-panel-grid">
            <div className="card admin-panel">
              <h3>System Overview</h3>
              <ul className="admin-list">
                <li>Secure admin authentication enabled</li>
                <li>MongoDB-backed user management</li>
                <li>Role-based access restrictions</li>
                <li>Operational metrics and user visibility</li>
              </ul>
            </div>

            <div className="card admin-panel">
              <h3>Users</h3>
              <div className="admin-users-table-wrap">
                <table className="admin-users-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan="4">No admin users found.</td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id}>
                          <td>{user.name}</td>
                          <td>{user.email}</td>
                          <td>{user.role}</td>
                          <td>{user.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
                  </section>
                </>
              )}

              {activeSection === 'warehouses' && <WarehousesPanel apiBase={API_BASE} />}
              {activeSection === 'orders' && <OrdersPanel apiBase={API_BASE} />}
              {activeSection === 'forecast' && <ForecastPanel apiBase={API_BASE} />}
              {activeSection === 'inventory' && <InventoryPanel apiBase={API_BASE} />}
              {activeSection === 'products' && <ProductsPanel apiBase={API_BASE} />}
              {activeSection === 'suppliers' && <SuppliersPanel apiBase={API_BASE} />}
              {activeSection === 'map' && <GMap apiBase={API_BASE} />}
              {activeSection === 'kpis' && <KPIMetrics apiBase={API_BASE} />}
              {activeSection === 'ai' && <AIInsightsPanel apiBase={API_BASE} />}
              {activeSection === 'alerts' && <AlertsPanel apiBase={API_BASE} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
