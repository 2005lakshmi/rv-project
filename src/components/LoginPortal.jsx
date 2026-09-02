import { DRIVER_PROFILES } from '../constants/drivers';

export default function LoginPortal({ onAdminLogin, onDriverLogin }) {
  return (
    <div className="login-shell">
      <div className="login-hero">
        <div className="login-copy">
          <p className="login-kicker">Supply Chain Control Room</p>
          <h1>Admin dashboard and driver dispatch in one workflow</h1>
          <p>
            Admin enters directly into the dashboard. Drivers use warehouse-specific IDs to access delivery
            orders, launch Google Maps on the best route, and switch to an alternative route when traffic or
            disruption happens.
          </p>
        </div>
      </div>

      <div className="login-grid">
        <div className="card login-card">
          <h2>Admin Access</h2>
          <p className="login-note">
            Minimal authentication is enabled here. Continue directly to the admin dashboard and navbar.
          </p>
          <button className="btn btn-primary" onClick={onAdminLogin}>
            Continue to Admin Login
          </button>
        </div>

        <div className="card login-card">
          <h2>Driver Login</h2>
          <p className="login-note">Pick one of the five warehouse drivers and enter the delivery workspace.</p>
          <div className="driver-login-list">
            {DRIVER_PROFILES.map((driver) => (
              <button
                key={driver.id}
                className="driver-login-item"
                type="button"
                onClick={() => onDriverLogin(driver)}
              >
                <div>
                  <strong>{driver.name}</strong>
                  <p>{driver.warehouseName}</p>
                </div>
                <span>{driver.id}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
