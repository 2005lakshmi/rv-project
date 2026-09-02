import { useEffect, useMemo, useState } from 'react';
import DriverRouteMap from './DriverRouteMap';

const ISSUE_OPTIONS = ['Traffic congestion', 'Weather disruption', 'Road blockage', 'Vehicle issue'];

export default function DriverWorkspace({ apiBase, driver, onLogout }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [activeRoute, setActiveRoute] = useState(null);
  const [selectedAlternativeId, setSelectedAlternativeId] = useState('');
  const [issueByOrder, setIssueByOrder] = useState({});

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [driver.warehouseId]);

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${apiBase}/driver/orders/${driver.id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Unable to load driver orders');
      }

      setOrders(data.orders || []);
      setMessage('');
    } catch (error) {
      console.error('Error loading driver orders:', error);
      setMessage(error.message || 'Unable to load driver orders');
    } finally {
      setLoading(false);
    }
  };

  const handleDispatch = async (orderId) => {
    try {
      const res = await fetch(`${apiBase}/driver/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          driverId: driver.id,
          warehouseId: driver.warehouseId
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Unable to start delivery');
      }

      setActiveRoute({
        orderId,
        ...data,
        orderDetails: warehouseOrders.find((order) => order.id === orderId) || null
      });
      setSelectedAlternativeId(data.routeRecommendation?.id || '');
      setMessage(`Delivery started for ${orderId}. In-app navigation is now guiding the driver to the customer location.`);
      fetchOrders();
    } catch (error) {
      console.error('Dispatch error:', error);
      setMessage(error.message || 'Unable to start delivery');
    }
  };

  const handleAlternativeRoute = async (orderId) => {
    try {
      const reason = issueByOrder[orderId] || ISSUE_OPTIONS[0];
      const res = await fetch(`${apiBase}/disruption/simulate/blocked-route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          reason,
          delayHours: 3
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Unable to find an alternative route');
      }

      const selectedOrder = warehouseOrders.find((order) => order.id === orderId) || null;
      const alternativeRoutes = data.alternativeRoutes || data.analysis?.alternativeRoutes || [];
      const recommended = data.analysis?.recommendedRoute || alternativeRoutes[0] || null;

      setActiveRoute({
        orderId,
        googleMapsUrl: recommended?.googleMapsUrl,
        embedMapUrl: recommended?.embedMapUrl,
        routeRecommendation: recommended,
        alternativeRoutes,
        aiGuidance: data.analysis?.aiPrediction,
        analysis: data.analysis,
        origin: selectedOrder?.route?.origin || null,
        destination: selectedOrder?.customerLocation || null,
        customerLocationName:
          selectedOrder?.customerLocationName || 'Customer destination',
        orderDetails: selectedOrder
      });
      setSelectedAlternativeId(recommended?.id || '');
      setMessage(`Alternative route generated for ${orderId} because of ${reason.toLowerCase()}.`);
    } catch (error) {
      console.error('Alternative route error:', error);
      setMessage(error.message || 'Unable to find an alternative route');
    }
  };

  const handleDeliveryComplete = async (orderId) => {
    try {
      const res = await fetch(`${apiBase}/driver/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          driverId: driver.id
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Unable to complete delivery');
      }

      setMessage(`Order ${orderId} has been marked as delivered.`);
      setActiveRoute(null);
      await fetchOrders();
    } catch (error) {
      console.error('Delivery completion error:', error);
      setMessage(error.message || 'Unable to complete delivery');
    }
  };

  const warehouseOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.driverAssignment?.driverId === driver.id || order.assignedWarehouse === driver.warehouseId
      ),
    [orders, driver.id, driver.warehouseId]
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1>Driver Delivery Workspace</h1>
          <p>
            {driver.name} | {driver.id} | {driver.warehouseName}
          </p>
        </div>
        <div className="header-status">
          <span className="status-indicator online"></span>
          <p>Driver Active</p>
          <button className="btn btn-secondary" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="panel">
          <div className="grid-3">
            <div className="stat-box">
              <div className="stat-label">Warehouse</div>
              <div className="stat-value" style={{ fontSize: '24px' }}>
                {driver.warehouseId}
              </div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Assigned Orders</div>
              <div className="stat-value">{warehouseOrders.length}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Route Status</div>
              <div className="stat-value" style={{ fontSize: '24px' }}>
                {activeRoute?.routeRecommendation ? 'Ready' : 'Waiting'}
              </div>
            </div>
          </div>

          {message && (
            <div className="card">
              <div className="alert info" style={{ marginBottom: 0 }}>
                <span className="alert-icon">!</span>
                <div className="alert-content">
                  <strong>Driver Update</strong>
                  <p>{message}</p>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <h2 style={{ marginBottom: '16px' }}>Warehouse Orders</h2>
            {loading ? (
              <p>Loading assigned deliveries...</p>
            ) : warehouseOrders.length === 0 ? (
              <p>No assigned orders are ready for this warehouse right now.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Product</th>
                    <th>Driver ID</th>
                    <th>Customer Location</th>
                    <th>Status</th>
                    <th>Dispatch</th>
                    <th>Alternative</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouseOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.id}</td>
                      <td>{order.productId}</td>
                      <td>{order.driverAssignment?.driverId || driver.id}</td>
                      <td>{order.customerLocationName || 'Customer destination'}</td>
                      <td>
                        <span className={`badge badge-${getDriverStatusColor(order.status)}`}>{order.status}</span>
                      </td>
                      <td>
                        {order.status === 'delivered' ? (
                          <span className="badge badge-success">Delivered</span>
                        ) : (
                          <button className="btn btn-primary btn-small" onClick={() => handleDispatch(order.id)}>
                            Out for Delivery
                          </button>
                        )}
                      </td>
                      <td>
                        <select
                          className="form-input"
                          value={issueByOrder[order.id] || ISSUE_OPTIONS[0]}
                          onChange={(e) =>
                            setIssueByOrder((prev) => ({
                              ...prev,
                              [order.id]: e.target.value
                            }))
                          }
                          style={{ marginBottom: '8px' }}
                        >
                          {ISSUE_OPTIONS.map((issue) => (
                            <option key={issue} value={issue}>
                              {issue}
                            </option>
                          ))}
                        </select>
                        <button className="btn btn-secondary btn-small" onClick={() => handleAlternativeRoute(order.id)}>
                          Get Alternative
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {activeRoute && (
            <div className="card">
              <h2 style={{ marginBottom: '16px' }}>Best Route Guidance</h2>
              <div className="grid-2">
                <div style={{ padding: '16px', background: '#1a1a1a', borderRadius: '6px' }}>
                  <p><strong>Recommended Route</strong></p>
                  <p>{activeRoute.routeRecommendation?.label || 'Best route selected'}</p>
                  <p>
                    Distance: {activeRoute.routeRecommendation?.distance} km | Time:{' '}
                    {activeRoute.routeRecommendation?.deliveryHours} hrs
                  </p>
                  <p style={{ color: '#888' }}>{activeRoute.routeRecommendation?.reason}</p>
                  <button
                    className="btn btn-primary btn-small"
                    onClick={() => handleDeliveryComplete(activeRoute.orderId)}
                    style={{ marginTop: '12px' }}
                  >
                    Mark as Delivered
                  </button>
                </div>
                <div style={{ padding: '16px', background: '#1a1a1a', borderRadius: '6px' }}>
                  <p><strong>AI Route Guidance</strong></p>
                  <p>
                    {activeRoute.aiGuidance?.summary ||
                      activeRoute.aiGuidance?.recommendedRouteReason ||
                      activeRoute.analysis?.predictiveAnalysis?.summary}
                  </p>
                  <p style={{ color: '#888', marginBottom: '12px' }}>
                    {(activeRoute.aiGuidance?.watchouts || ['Traffic congestion', 'Weather disruption']).join(', ')}
                  </p>
                  <p><strong>Destination:</strong> {activeRoute.customerLocationName || activeRoute.orderDetails?.customerLocationName || 'Customer destination'}</p>
                </div>
              </div>

              {activeRoute.origin && activeRoute.destination && (
                <DriverRouteMap
                  apiBase={apiBase}
                  origin={activeRoute.origin}
                  destination={activeRoute.destination}
                  routeLabel={`${driver.warehouseName} to ${activeRoute.customerLocationName || 'customer'}`}
                />
              )}

              {activeRoute.alternativeRoutes?.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <h3 style={{ marginBottom: '12px' }}>Alternative Routes</h3>
                  {activeRoute.alternativeRoutes.map((route) => {
                    const isSelected = selectedAlternativeId === route.id || (!selectedAlternativeId && route.id === activeRoute.routeRecommendation?.id);
                    return (
                      <div
                        key={route.id}
                        style={{
                          padding: '12px',
                          marginBottom: '10px',
                          background: isSelected ? '#18324d' : '#1a1a1a',
                          borderRadius: '6px',
                          borderLeft: isSelected ? '4px solid #4ecdc4' : '4px solid #0066cc',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                          flexWrap: 'wrap'
                        }}
                      >
                        <div>
                          <strong>{route.label}</strong>
                          <p style={{ margin: '6px 0 0' }}>
                            {route.distance} km | {route.deliveryHours} hrs | ${route.cost}
                          </p>
                          <p style={{ margin: '4px 0 0', color: '#b8c4d9' }}>{route.reason}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-secondary btn-small"
                            onClick={() => {
                              setSelectedAlternativeId(route.id);
                              setActiveRoute((prev) => ({
                                ...prev,
                                routeRecommendation: route
                              }));
                            }}
                          >
                            {isSelected ? 'Selected' : 'Use This Route'}
                          </button>
                          {route.googleMapsUrl && (
                            <button
                              className="btn btn-primary btn-small"
                              onClick={() => window.open(route.googleMapsUrl, '_blank', 'noopener,noreferrer')}
                            >
                              Navigate
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function getDriverStatusColor(status) {
  const colors = {
    pending: 'warning',
    assigned: 'info',
    out_for_delivery: 'primary',
    shipped: 'primary',
    delivered: 'success',
    failed: 'danger'
  };

  return colors[status] || 'primary';
}
