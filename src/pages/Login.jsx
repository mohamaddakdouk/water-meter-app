import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const { search } = useLocation();
  
  // Determine whether this login page should use admin or user mode
  // based on URL query string parameters like ?role=admin
  const queryParams = new URLSearchParams(search);
  const role = queryParams.get('role') || 'user';

  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Send login credentials and role preference to the backend
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password,
          role: role 
        })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        
        if (data.meterID) {
          localStorage.setItem('meterID', data.meterID);
        }

        // Route users to the appropriate dashboard after login
        if (data.role === 'admin') {
          navigate('/admin-dashboard');
        } else {
          navigate('/user-dashboard');
        }
      } else {
        setError(data.message || 'Invalid Credentials');
      }
    } catch (err) {
      setError('Connection Error. Check if backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page page--centered">
      <div className="glow1"></div>
      <div className="glow2"></div>

      <div className="card card--login">
        <h2 className="page-title">{role.toUpperCase()} <span className="highlight">LOGIN</span></h2>

        {error && <p className="error-text" style={{ color: '#ff4d4d', marginBottom: '10px' }}>{error}</p>}

        <form onSubmit={handleLogin}>
          <input
            name="username"
            type="text"
            placeholder="Username / ID"
            className="input" 
            value={credentials.username}
            onChange={handleChange}
            required
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            className="input"
            value={credentials.password}
            onChange={handleChange}
            required
          />

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Loading...' : 'Login'}
          </button>
        </form>

        <button onClick={() => navigate('/')} className="back-btn">
          Return to main screen
        </button>
      </div>
    </div>
  );
}
