import { useEffect, useState } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import WarehousesPanel from './components/WarehousesPanel';
import OrdersPanel from './components/OrdersPanel';
import ForecastPanel from './components/ForecastPanel';
import DisruptionPanel from './components/DisruptionPanel';
import KPIMetrics from './components/KPIMetrics';
import AlertsPanel from './components/AlertsPanel';
import AIInsightsPanel from './components/AIInsightsPanel';
import GMap from './components/gmap';
import LoginPortal from './components/LoginPortal';
import DriverWorkspace from './components/DriverWorkspace';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';

const API_BASE = 'http://localhost:3000/api';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [session, setSession] = useState(null);

  useEffect(() => {
    checkServer();
    const savedToken = localStorage.getItem('admin_token');
    const savedUser = localStorage.getItem('admin_user');

    if (savedToken && savedUser) {
      setSession({ role: 'admin' });
    }
  }, []);

  const checkServer = async () => {
    try {
      const response = await fetch(`${API_BASE}/health`);
      if (!response.ok) throw new Error('Server not responding');
    } catch (err) {
      console.error('Server check failed:', err);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setSession(null);
  };

  const tabs = [
    { id: 'dashboard', label: 'Home', icon: '' },
    { id: 'warehouses', label: 'Whs', icon: '' },
    { id: 'orders', label: 'Orders', icon: '' },
    { id: 'forecast', label: 'Forecast', icon: '' },
    { id: 'kpis', label: 'KPIs', icon: '' },
    { id: 'ai', label: 'AI', icon: '' },
    { id: 'map', label: 'Map', icon: '' },
    { id: 'disruption', label: 'Risk', icon: '' },
    { id: 'alerts', label: 'Alerts', icon: '' }
  ];

  if (!session) {
    return (
      <LoginPortal
        onAdminLogin={() => setSession({ role: 'admin-login' })}
        onDriverLogin={(driver) => setSession({ role: 'driver', driver })}
      />
    );
  }

  if (session.role === 'admin-login') {
    return <AdminLogin onAuthSuccess={() => setSession({ role: 'admin' })} />;
  }

  if (session.role === 'driver') {
    return <DriverWorkspace apiBase={API_BASE} driver={session.driver} onLogout={() => setSession(null)} />;
  }

  if (session.role === 'admin') {
    return (
      <AdminDashboard
        onLogout={handleAdminLogout}
        onOpenLogistics={() => setSession({ role: 'logistics' })}
      />
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1>Supply Chain Logistics and Optimization System</h1>
          <p>AI-powered inventory, routing, disruption management, and driver dispatch</p>
        </div>
        <div className="header-status">
          <span className="status-indicator online"></span>
          <p>Admin Online</p>
          <button className="btn btn-secondary" onClick={handleAdminLogout}>
            Logout
          </button>
        </div>
      </header>

      <nav className="app-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`nav-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="app-main">
        {activeTab === 'dashboard' && <Dashboard apiBase={API_BASE} />}
        {activeTab === 'warehouses' && <WarehousesPanel apiBase={API_BASE} />}
        {activeTab === 'orders' && <OrdersPanel apiBase={API_BASE} />}
        {activeTab === 'forecast' && <ForecastPanel apiBase={API_BASE} />}
        {activeTab === 'kpis' && <KPIMetrics apiBase={API_BASE} />}
        {activeTab === 'ai' && <AIInsightsPanel apiBase={API_BASE} />}
        {activeTab === 'map' && <GMap apiBase={API_BASE} />}
        {activeTab === 'disruption' && <DisruptionPanel apiBase={API_BASE} />}
        {activeTab === 'alerts' && <AlertsPanel apiBase={API_BASE} />}
      </main>

      <footer className="app-footer">
        <p>Supply Chain Logistics System with admin and driver workflows</p>
        <p>Demand Forecasting • Inventory Optimization • Dynamic Routing • Disruption Resilience</p>
      </footer>
    </div>
  );
}

export default App;
