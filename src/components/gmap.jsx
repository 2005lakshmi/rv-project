import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export default function GMap({ apiBase }) {
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedType, setSelectedType] = useState('warehouse');
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mapReady, setMapReady] = useState(false);

  const mapElementRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        setLoading(true);
        setError('');

        const [warehouseRes, customerRes, orderRes] = await Promise.all([
          fetch(`${apiBase}/warehouses`),
          fetch(`${apiBase}/customers`),
          fetch(`${apiBase}/orders`)
        ]);

        if (!warehouseRes.ok || !customerRes.ok || !orderRes.ok) {
          throw new Error('Unable to load map data');
        }

        const warehouseData = await warehouseRes.json();
        const customerData = await customerRes.json();
        const orderData = await orderRes.json();

        setWarehouses(warehouseData);
        setCustomers(customerData);
        setOrders(orderData.orders || []);

        if (warehouseData.length > 0) {
          setSelectedType('warehouse');
          setSelectedId(warehouseData[0].id);
        }
      } catch (err) {
        console.error('Error loading map data:', err);
        setError(err.message || 'Unable to load map data');
      } finally {
        setLoading(false);
      }
    };

    fetchMapData();
  }, [apiBase]);

  useEffect(() => {
    setMapReady(true);
  }, []);

  const orderLocations = useMemo(() => {
    return orders
      .filter((order) => order.userLocation || order.customerLocation)
      .map((order) => ({
        id: order.id,
        name: order.userLocationName || `Order ${order.id}`,
        subtitle: `${order.productId} | Qty ${order.quantity}`,
        location: order.userLocation || order.customerLocation
      }));
  }, [orders]);

  const selectedOptions = useMemo(() => {
    if (selectedType === 'warehouse') {
      return warehouses.map((warehouse) => ({
        id: warehouse.id,
        name: warehouse.name,
        subtitle: `Capacity ${warehouse.capacity}`,
        location: warehouse.location
      }));
    }

    if (selectedType === 'customer') {
      return customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        subtitle: customer.region,
        location: customer.location
      }));
    }

    return orderLocations;
  }, [selectedType, warehouses, customers, orderLocations]);

  useEffect(() => {
    if (selectedOptions.length === 0) {
      setSelectedId('');
      return;
    }

    const hasSelection = selectedOptions.some((item) => item.id === selectedId);
    if (!hasSelection) {
      setSelectedId(selectedOptions[0].id);
    }
  }, [selectedOptions, selectedId]);

  const selectedLocation = selectedOptions.find((item) => item.id === selectedId) || null;

  useEffect(() => {
    if (!mapReady || !mapElementRef.current) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const centerLat = selectedLocation?.location?.lat ?? warehouses[0]?.location?.lat ?? 12.9716;
    const centerLon = selectedLocation?.location?.lon ?? warehouses[0]?.location?.lon ?? 77.5946;

    mapInstanceRef.current = L.map(mapElementRef.current).setView([centerLat, centerLon], 9);
    L.tileLayer(OSM_TILE_URL, {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInstanceRef.current);

    if (selectedType === 'warehouse' && warehouses.length > 0) {
      const bounds = [];

      warehouses.forEach((warehouse) => {
        const marker = L.marker([warehouse.location.lat, warehouse.location.lon]).addTo(mapInstanceRef.current);
        marker.bindPopup(`<strong>${warehouse.name}</strong><br/>Capacity: ${warehouse.capacity}<br/>Stock: ${Object.values(warehouse.currentStock || {}).reduce((a, b) => a + b, 0)}`);
        markersRef.current.push(marker);
        bounds.push([warehouse.location.lat, warehouse.location.lon]);
      });

      if (bounds.length > 0) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [24, 24] });
      }
    } else if (selectedLocation?.location) {
      const marker = L.marker([selectedLocation.location.lat, selectedLocation.location.lon]).addTo(mapInstanceRef.current);
      marker.bindPopup(`<strong>${selectedLocation.name}</strong><br/>${selectedLocation.subtitle || ''}`);
      markersRef.current.push(marker);
      mapInstanceRef.current.setView([selectedLocation.location.lat, selectedLocation.location.lon], 12);
    }
  }, [mapReady, selectedLocation, selectedType, warehouses]);

  if (loading) {
    return (
      <div className="panel">
        <p>Loading map...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel">
        <div className="card">
          <div className="alert danger" style={{ marginBottom: 0 }}>
            <span className="alert-icon">!</span>
            <div className="alert-content">
              <strong>Map unavailable</strong>
              {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2 style={{ marginBottom: '20px' }}>Map View</h2>

      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '12px', alignItems: 'end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">View Type</label>
            <select className="form-input" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
              <option value="warehouse">Warehouses</option>
              <option value="customer">Customers</option>
              <option value="order">Orders</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Location</label>
            <select className="form-input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {selectedOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedLocation ? (
        <>
          <div className="card">
            <div className="grid-2">
              <div>
                <div className="card-title">{selectedLocation.name}</div>
                <p>{selectedLocation.subtitle || 'Location details'}</p>
                <p style={{ marginTop: '8px' }}>
                  Coordinates: {selectedLocation.location.lat.toFixed(4)}, {selectedLocation.location.lon.toFixed(4)}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <a
                  className="btn btn-primary"
                  href={`https://www.openstreetmap.org/?mlat=${selectedLocation.location.lat}&mlon=${selectedLocation.location.lon}#map=12/${selectedLocation.location.lat}/${selectedLocation.location.lon}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in OSM
                </a>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              ref={mapElementRef}
              style={{
                width: '100%',
                height: '520px',
                minHeight: '520px',
                background: '#e9eef5'
              }}
            />
          </div>
        </>
      ) : (
        <div className="card">
          <p>No map location available.</p>
        </div>
      )}
    </div>
  );
}
