import { useNavigate } from 'react-router-dom';

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="glow1"></div>
      <div className="glow2"></div>

      <nav className="nav">
        <div className="logo">SMART<span>STREAM</span></div>
      </nav>

      <div className="hero">
        <div className="hero__left">
          <p className="eyebrow">IoT Powered Water Management</p>

          <h1 className="title">
            SMART <span className="highlight">WATER</span> METER
          </h1>

          <p className="desc">
            Deploying advanced IoT telemetry for real-time water quality tracking and automated billing cycles.
            Our smart sensors monitor turbidity levels and water consumption with high-fidelity data reporting.
          </p>

          <button className="btn-primary" onClick={() => navigate('/login')}>
            ENTER SYSTEM
          </button>
        </div>

        <div className="card">
          <div className="card__header">
            <div className="badge"></div>
            <span className="card__label">System: Live Data</span>
          </div>

          <div className="card__usage">
            <small>Current Usage</small>
            <div className="value">1,425 <span className="unit">Liters</span></div>
          </div>

          <div className="progress">
            <div className="progress__fill"></div>
          </div>

          <div className="status">
            <small>Turbidity Status</small>
            <div className="value">CLEAN</div>
          </div>
        </div>
      </div>
    </div>
  );
}
