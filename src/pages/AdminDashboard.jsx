import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('users'); 
  const [monitorID, setMonitorID] = useState("");
  const [chartPeriod, setChartPeriod] = useState('daily');
  const [searchTerm, setSearchTerm] = useState("");
  
  const [showBillCard, setShowBillCard] = useState(false);
  const [price, setPrice] = useState("");
  const [showDeleteCard, setShowDeleteCard] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [popupStatus, setPopupStatus] = useState({ show: false, msg: '', type: '' });

  const [data, setData] = useState({ users: [], alerts: [], bills: [], live: {}, daily: [], monthly: [] });
  const [newUser, setNewUser] = useState({ username: '', phone: '', meterID: '', password: '' });

  // Map turbidity voltage to readable water quality states
  const getQualityInfo = (volts) => {
    if (volts === undefined || volts === null || volts === 0) {
      return { label: "No Data", color: "#9ca3af" }; // No sensor data available
    }

    const v = Number(volts);
    if (v > 1.65) return { label: "Very Clean", color: "#4ade80" };   
    if (v > 1.58) return { label: "Clean", color: "#22c55e" };       
    if (v > 1.55) return { label: "Slightly Cloudy", color: "#fb923c" }; 
    if (v > 1.3)  return { label: "Cloudy", color: "#ef4444" };          
    return { label: "Very Dirty", color: "#b91c1c" };                   
  };



  // Load all admin data needed for the dashboard in a single fetch
  const fetchAdminData = async () => {
    try {
      // Use a fallback ID when monitorID is empty so API calls do not fail
      const targetID = monitorID && monitorID.trim() !== "" ? monitorID : "0";

      const [u, a, b, s, d, m] = await Promise.all([ 
        fetch('/api/admin/users').then(r => r.json()),
        fetch('/api/admin/alerts').then(r => r.json()),
        fetch('/api/admin/bills').then(r => r.json()),
        fetch(`/api/status/${targetID}`).then(r => r.json()),
        fetch(`/api/history/daily/${targetID}`).then(r => r.json()),
        fetch(`/api/history/monthly/${targetID}`).then(r => r.json())
      ]);
      
      setData({ users: u || [], alerts: a || [], bills: b || [], live: s.live || {}, daily: d || [], monthly: m || [] });
    } catch (e) { console.log("Syncing..."); }
  };

  useEffect(() => {
    fetchAdminData();
    const interval = setInterval(fetchAdminData, 5000);
    return () => clearInterval(interval);
  }, [monitorID, activeTab]);

  const handleInputChange = (e) => {
    setNewUser({ ...newUser, [e.target.name]: e.target.value });
  };

  const triggerStatusPopup = (msg, type) => {
    setPopupStatus({ show: true, msg, type });
    setTimeout(() => setPopupStatus({ show: false, msg: '', type: '' }), 3000);
  };

  // Create a new user and send the registration to the backend
  const handleSaveUser = async () => {
    if (!newUser.username || !newUser.meterID || !newUser.phone || !newUser.password) {
      triggerStatusPopup("Please fill all fields!", "error");
      return;
    }

    // Prevent duplicate meter IDs before making the create request
    const isMeterTaken = data.users.some(u => String(u.meterID) === String(newUser.meterID));
    if (isMeterTaken) {
      triggerStatusPopup("❌ Error: Meter ID already registered!", "error");
      return;
    }

    const res = await fetch('/api/admin/users/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser)
    });
    
    const result = await res.json();

    if (res.ok && result.success) {
      triggerStatusPopup("🎉 User Registered Successfully!", "success");
      setNewUser({ username: '', phone: '', meterID: '', password: '' });
      fetchAdminData();
    } else {
      triggerStatusPopup(`❌ ${result.message || "Registration Failed!"}`, "error");
    }
  };

  // Delete an existing user after confirmation
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    const res = await fetch(`/api/admin/users/delete/${userToDelete}`, { method: 'DELETE' });
    if (res.ok) {
      triggerStatusPopup("🗑️ User deleted successfully!", "success");
      fetchAdminData();
    } else {
      triggerStatusPopup("❌ Failed to delete user", "error");
    }
    setShowDeleteCard(false);
    setUserToDelete(null);
  }; 

  // Mark a bill as paid and send a notification alert to the meter owner
  const handlePayBill = async (billId) => {
    const cleanId = typeof billId === 'object' && billId.$oid ? billId.$oid : billId;
    try {
      const res = await fetch(`/api/admin/bills/pay/${cleanId}`, { method: 'PUT' });
      if (res.ok) {
        triggerStatusPopup("💳 Invoice updated to Paid!", "success");
        fetchAdminData();
      } else {
        triggerStatusPopup("❌ Payment update failed", "error");
      }
    } catch (err) {
      triggerStatusPopup("❌ Connection error", "error");
    }
  }; 

  const quality = getQualityInfo(data.live?.turbidity || 0);

  return (

    <div className="page dashboard-grid">
      <div className="glow1"></div>
      <div className="glow2"></div>

      {/* Status popup notifications */}
      {popupStatus.show && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 2000 }}>
          <div className="card" style={{ border: `1px solid ${popupStatus.type === 'success' ? 'var(--accent-lime)' : '#ff4d4d'}`, padding: '15px 25px', display: 'flex', alignItems: 'center', background: 'rgba(2, 6, 23, 0.9)', backdropFilter: 'blur(10px)' }}>
            <span style={{ color: popupStatus.type === 'success' ? 'var(--accent-lime)' : '#ff4d4d', fontWeight: 'bold' }}>{popupStatus.msg}</span>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteCard && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '350px', border: '1px solid #ff4d4d', padding: '30px' }}>
            <h2 className="card__label" style={{ marginBottom: '10px', color: '#ff4d4d' }}>Confirm Deletion</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px' }}>Are you sure you want to permanently delete this user document parameters?</p>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button className="btn-primary" style={{ flex: 1, background: '#ff4d4d', borderColor: '#ff4d4d' }} onClick={confirmDeleteUser}>Delete</button>
              <button className="back-btn" style={{ flex: 1 }} onClick={() => { setShowDeleteCard(false); setUserToDelete(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Bill generation modal */}
      {showBillCard && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '350px', border: '1px solid var(--primary-cyan)', padding: '30px' }}>
            <h2 className="card__label" style={{ marginBottom: '20px' }}>Generate Bills</h2>
            <input type="number" className="input" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price per Liter" />
            <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={async () => {
                const res = await fetch('/api/admin/generate-bills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pricePerLiter: price }) });
                if (res.ok) triggerStatusPopup("🎉 Bills & Invoices Generated!", "success");
                setShowBillCard(false); fetchAdminData();
              }}>Confirm</button>
              <button className="back-btn" style={{ flex: 1 }} onClick={() => setShowBillCard(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <aside className="sidebar">
        <div className="nav-group">
          <div className="logo" style={{ marginBottom: '50px' }}>SMART<span>STREAM</span></div>
          <button onClick={() => setActiveTab('users')} className={`nav-btn ${activeTab === 'users' ? 'active' : ''}`}>👥 Users Management</button>
          <button onClick={() => setActiveTab('monitor')} className={`nav-btn ${activeTab === 'monitor' ? 'active' : ''}`}>📡 Monitor Meters</button>
          <button onClick={() => setActiveTab('alerts')} className={`nav-btn ${activeTab === 'alerts' ? 'active' : ''}`}>⚠️ Alerts View</button>
          <button onClick={() => setActiveTab('billing')} className={`nav-btn ${activeTab === 'billing' ? 'active' : ''}`}>🧾 Billing Managment</button>
        </div>
        <div className="logout-container">
          <button className="nav-btn--logout" onClick={() => { localStorage.clear(); window.location.replace('/login'); }}><span>Log Out</span></button>
        </div>
      </aside>

      <main className="main-content">
        {/* Users management tab */}
        {activeTab === 'users' && (
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
            <div className="card">
              <h2 className="card__label">Register User</h2>
              <div style={{ marginTop: '20px' }}>
                <input type="text" name="username" value={newUser.username} onChange={handleInputChange} className="input" placeholder="Full Name" />
                <input type="text" name="phone" value={newUser.phone} onChange={handleInputChange} className="input" placeholder="Phone Number" />
                <input type="text" name="meterID" value={newUser.meterID} onChange={handleInputChange} className="input" placeholder="Meter ID" />
                <input type="password" name="password" value={newUser.password} onChange={handleInputChange} className="input" placeholder="Password" />
                <button onClick={handleSaveUser} className="btn-primary" style={{ width: '100%', marginTop: '10px' }}>Save User</button>
              </div>
            </div>
            <div className="card table-wrapper">
              <div className="chart-header" style={{ marginBottom: '20px' }}>
                <h2 className="card__label">User Directory</h2>
                <input type="text" className="input" placeholder="Search users..." style={{ width: '200px', margin: 0 }} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <table className="admin-table">
                <thead><tr><th>User</th><th>Phone</th><th>Meter</th><th>Actions</th></tr></thead>
                <tbody>
                  {(data.users || []).filter(u => u.username?.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
                    <tr key={u._id}>
                      <td>{u.username}</td>
                      <td>{u.phone}</td>
                      <td>{u.meterID}</td>
                      <td>
                        <button className="back-btn" style={{ color: '#ff4d4d', borderColor: '#ff4d4d' }} onClick={() => { setUserToDelete(u._id); setShowDeleteCard(true); }}>Delete</button>
                        <button className="back-btn" style={{ marginLeft: '5px' }} onClick={() => { setMonitorID(u.meterID); setActiveTab('monitor'); }}>Monitor</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Meter monitoring tab */}
        {activeTab === 'monitor' && (

          <div className="main-container monitor-layout-wrapper">
            <div className="monitor-sidebar-stats">
              <div className="card" style={{ padding: '20px' }}>
                <small className="eyebrow" style={{ fontSize: '0.7rem', marginBottom: '10px', display: 'block' }}>Search Meter ID</small>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="e.g. 101" 
                  style={{ margin: 0, background: 'rgba(255,255,255,0.03)' }}
                  value={monitorID}
                  onChange={(e) => setMonitorID(e.target.value)}
                />
              </div>

              <div className="card">
                <div className="card__header">
                  <div className="badge" style={{ 
      background: quality.label === "No Data" ? "#9ca3af" : "#22c55e", 
      boxShadow: quality.label === "No Data" ? "none" : "0 0 12px #22c55e" 
    }}></div>
                  <span className="card__label">System: Live Data</span>
                </div>
                <div className="card__usage">
                  <small>Current Usage</small>
                  <div className="value">
                    {data.live.totalLiters?.toLocaleString()}
                    <span className="unit">Liters</span>
                  </div>
                </div>
                <div className="progress"><div className="progress__fill" style={{ width: '70%' }}></div></div>
                <div className="status">
                  <small>Water Quality Status</small>
                  <div className="value" style={{ color: quality.color, textShadow: `0 0 10px ${quality.color}44`, transition: 'all 0.3s ease' }}>{quality.label}</div>
                </div>
              </div>
            </div>
            
    <div className="monitor-main-chart-area">
      <div className="card admin-chart-card" style={{ height: '480px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card__label">Detailed Analytics</h2>
          <div className="tab-group">
            <button className={`tab-item ${chartPeriod === 'daily' ? 'active' : ''}`} onClick={() => setChartPeriod('daily')}>Daily</button>
            <button className={`tab-item ${chartPeriod === 'monthly' ? 'active' : ''}`} onClick={() => setChartPeriod('monthly')}>Monthly</button>
          </div>
        </div>
        <div className="chart-body" style={{ height: '340px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartPeriod === 'daily' ? data.daily : data.monthly} margin={{ left: 10, right: 30, top: 20, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tick={{ dy: 10 }} />
              
              {/* Fix: Outputs a clean single zero baseline text string mapping */}
              <YAxis 
                stroke="#94a3b8" 
                fontSize={11} 
                tickFormatter={(value) => (Number(value) === 0 ? "0" : value)} 
              />
              
              <Tooltip contentStyle={{ background: '#020617', borderRadius: '12px' }} />
              <Area type="monotone" dataKey="liters" stroke="var(--primary-cyan)" fill="rgba(34, 211, 238, 0.1)" strokeWidth={4} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
          </div>
        )}

        {/* Alerts tab */}
        {activeTab === 'alerts' && (
          <div className="card table-wrapper" style={{ width: '100%', minHeight: '500px' }}>
            <h2 className="card__label" style={{ marginBottom: '20px' }}>System Logs</h2>
            <table className="admin-table">
              <thead><tr><th>Meter ID</th><th>Message</th><th>Timestamp</th></tr></thead>
              <tbody>
                {data.alerts.map((a, i) => (
                  <tr key={i}><td>{a.meterID}</td><td>{a.message}</td><td>{new Date(a.timestamp).toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Billing tab */}
        {activeTab === 'billing' && (
          <div className="card table-wrapper" style={{ width: '100%', minHeight: '500px' }}>
            <div className="chart-header" style={{ marginBottom: '20px' }}>
              <h2 className="card__label">Invoicing</h2>
              <button className="btn-primary" onClick={() => setShowBillCard(true)}>Generate Bills</button>
            </div>
            <table className="admin-table">
              <thead><tr><th>Meter</th><th>Period</th><th>Usage</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {data.bills.map(b => (
                  <tr key={b._id}>
                    <td>{b.meterID}</td>
                    <td>{b.billingPeriod}</td>
                    <td>{b.consumption} L</td>
                    <td>{b.totalAmount.toLocaleString()} USD</td>
                    <td>
                      <button 
                        onClick={() => b.status === 'Unpaid' && handlePayBill(b._id)}
                        className="back-btn"
                        style={{ 
                          color: b.status === 'Paid' ? 'var(--accent-lime)' : '#ff4d4d',
                          borderColor: b.status === 'Paid' ? 'var(--accent-lime)' : '#ff4d4d',
                          cursor: b.status === 'Unpaid' ? 'pointer' : 'default',
                          padding: '4px 10px'
                        }}
                      >
                        {b.status} {b.status === 'Unpaid' && '💳'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
