import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export default function DriverRouteMap({ apiBase, origin, destination, routeLabel }) {
  const mapElementRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const originMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const routeLineRef = useRef(null);
  const [error, setError] = useState('');

  const navigationUrl = useMemo(() => {
    if (!origin || !destination) {
      return '';
    }

    return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${origin.lat}%2C${origin.lon}%3B${destination.lat}%2C${destination.lon}`;
  }, [origin, destination]);

  useEffect(() => {
    let cancelled = false;

    async function renderRoute() {
      if (!origin || !destination || !mapElementRef.current) {
        return;
      }

      try {
        setError('');

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const map = L.map(mapElementRef.current).setView([origin.lat, origin.lon], 10);
        mapInstanceRef.current = map;

        L.tileLayer(OSM_TILE_URL, {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        const originString = `${origin.lat},${origin.lon}`;
        const destinationString = `${destination.lat},${destination.lon}`;

        let routeCoordinates = [
          [origin.lat, origin.lon],
          [destination.lat, destination.lon]
        ];

        if (apiBase) {
          try {
            const routeRes = await fetch(`${apiBase}/maps/route?origin=${encodeURIComponent(originString)}&destination=${encodeURIComponent(destinationString)}&mode=driving`);
            const routeData = await routeRes.json();

            if (routeRes.ok && routeData?.geometry?.coordinates?.length) {
              routeCoordinates = routeData.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
            }
          } catch (routeErr) {
            console.warn('OSRM fetch failed, falling back to straight line route', routeErr);
          }
        }

        const polyline = L.polyline(routeCoordinates, {
          color: '#0066cc',
          weight: 6,
          opacity: 0.9
        }).addTo(map);
        routeLineRef.current = polyline;

        const bounds = L.latLngBounds(routeCoordinates);
        map.fitBounds(bounds, { padding: [24, 24] });

        originMarkerRef.current = L.marker([origin.lat, origin.lon]).addTo(map);
        destinationMarkerRef.current = L.marker([destination.lat, destination.lon]).addTo(map);

        originMarkerRef.current.bindPopup('Warehouse');
        destinationMarkerRef.current.bindPopup('Customer');
      } catch (err) {
        console.error('Error rendering driver route map:', err);
        if (!cancelled) {
          setError(err.message || 'Unable to render route on map');
        }
      }
    }

    renderRoute();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (routeLineRef.current) {
        routeLineRef.current.remove();
        routeLineRef.current = null;
      }
      if (originMarkerRef.current) {
        originMarkerRef.current.remove();
        originMarkerRef.current = null;
      }
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
        destinationMarkerRef.current = null;
      }
    };
  }, [apiBase, origin, destination]);

  return (
    <div className="card" style={{ marginTop: '16px', padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>{routeLabel || 'Live Delivery Route'}</h3>
          {navigationUrl && (
            <button
              className="btn btn-primary btn-small"
              onClick={() => window.open(navigationUrl, '_blank', 'noopener,noreferrer')}
              style={{ whiteSpace: 'nowrap' }}
            >
              Start Navigation
            </button>
          )}
        </div>
        {error && <p style={{ color: '#ff6b6b', marginTop: '8px' }}>{error}</p>}
      </div>
      <div
        ref={mapElementRef}
        style={{
          width: '100%',
          height: '420px',
          minHeight: '420px',
          background: '#e9eef5',
          marginTop: '12px'
        }}
      />
    </div>
  );
}
