import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const SmartDashboard = () => {
  const [activeTab, setActiveTab] = useState('home'); 
  const [chartPeriod, setChartPeriod] = useState('daily'); 
  const [data, setData] = useState({ 
    live: { totalLiters: 0, turbidity: 0 }, 
    alerts: [], 
    daily: [], 
    monthly: [] 
  });

  // Convert turbidity voltage to a human-friendly water quality label
  const getQualityInfo = (volts) => {
    if (volts === undefined || volts === null || volts === 0) {
      return { label: "No Data", color: "#9ca3af" }; // No data available yet
    }

    const v = Number(volts);
    if (v > 1.65) return { label: "Very Clean", color: "#4ade80" };     
    if (v > 1.58) return { label: "Clean", color: "#22c55e" };          
    if (v > 1.55) return { label: "Slightly Cloudy", color: "#fb923c" }; 
    if (v > 1.3)  return { label: "Cloudy", color: "#ef4444" };          
    return { label: "Very Dirty", color: "#b91c1c" };                   
  };



  // Fetch live metrics, daily history, and monthly history for the current meter
  const fetchAll = async () => {
    try {
      const mID = localStorage.getItem('meterID');
      
      if (!mID || mID === 'undefined' || mID === 'null') {
        console.log("Waiting for a valid meter ID...");
        return;
      }

      const [resS, resD, resM] = await Promise.all([
        fetch(`/api/status/${mID}`),
        fetch(`/api/history/daily/${mID}`),
        fetch(`/api/history/monthly/${mID}`)
      ]);

      const status = await resS.json();
      const daily = await resD.json();
      const monthly = await resM.json();

      const liveObject = status && status.live ? status.live : { totalLiters: 0, turbidity: 0 };

      setData({ 
        live: {
          ...liveObject,
          totalLiters: parseFloat(liveObject.totalLiters) || 0 
        }, 
        alerts: status.alerts || [], 
        daily: daily || [], 
        monthly: monthly || [] 
      });

    } catch (e) { 
      console.error("Fetch Error"); 
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, []);

  const quality = getQualityInfo(data.live.turbidity || 0);


  return (
    <div className="page dashboard-grid">
      <div className="glow1"></div>
      <div className="glow2"></div>

      {/* --- SIDEBAR --- */}
      <aside className="sidebar">
        <div className="nav-group">
          <div className="logo" style={{ marginBottom: '50px' }}>SMART<span>STREAM</span></div>
          
          <button 
            onClick={() => setActiveTab('home')} 
            className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`}
          >
            🏠 Home Overview
          </button>
          
          <button 
            onClick={() => setActiveTab('analytics')} 
            className={`nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          >
            📈 Usage Analytics
          </button>
        </div>
        <div className="logout-container">
          <button className="nav-btn--logout" type="button" onClick={() => window.location.replace('/login')}>Log Out</button>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="main-content">
        {activeTab === 'home' ? (
          <div className="stats-grid">
            {/* Real-time Card */}
            <div className="card">
              <div className="card__header"><div className="badge" style={{ 
      background: quality.label === "No Data" ? "#9ca3af" : "#22c55e", 
      boxShadow: quality.label === "No Data" ? "none" : "0 0 12px #22c55e" 
    }}></div>
                <span className="card__label">System: Live Data</span>
              </div>
              <div className="card__usage">
                <small>Current Usage</small>
                <div className="value">{data.live.totalLiters}<span className="unit">Liters</span></div>
              </div>

              <div className="progress">
                <div className="progress__fill"></div>
              </div>

              <div className="status">
                <small>Water Quality Status</small>
                <div 
                  className="value" 
                  style={{ 
                    color: quality.color, 
                    textShadow: `0 0 10px ${quality.color}44`, 
                    transition: 'all 0.3s ease' 
                  }}
                >
                  {quality.label}
                </div>
              </div>
            </div>

                  {/* Notifications Card - Identical Design */}
            <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <span className="card__label" style={{ marginBottom: '20px' }}>System Notifications</span>

              <div className="alerts-container">
                {data.alerts.length > 0 ? data.alerts.map((a, i) => {
                  // Detect embedded PDF links and split the alert text accordingly
                  const hasLink = a.message.includes('[LINK:');
                  const messageParts = hasLink ? a.message.split('[LINK:') : [a.message, ""];
                  const fileName = hasLink ? messageParts[1].replace(']', '') : "";

                  return (
                    <div key={i} className="alert-item">
                      <div className="alert-icon-box">🔔</div>
                      <div className="alert-text-content">
                        <b>System Notification</b>
                        <p>
                          {messageParts[0]}
                          {hasLink && (
                            <a 
                              href={`http://localhost:5000/bills/${fileName}`} 
                              target="_blank" 
                              rel="noreferrer"
                              style={{ 
                                color: 'var(--primary-cyan)', 
                                fontWeight: 'bold', 
                                textDecoration: 'underline',
                                marginLeft: '5px'
                              }}
                            >
                              View PDF Invoice
                            </a>
                          )}
                        </p>
                        <small style={{ display: 'block', marginTop: '8px', opacity: 0.4, fontSize: '0.7rem' }}>
                          {new Date(a.timestamp).toLocaleString()}
                        </small>
                      </div>
                    </div>
                  );
                }) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    No new messages at the moment.
                  </div>
                )}
              </div>
            </div>
          </div>

        ) : (
          
          <div className="card full-chart-card" style={{ width: '100%', height: '550px', padding: '40px', border: '1px solid var(--glass-border)' }}>
            <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div>
                <h2 className="card__label" style={{ fontSize: '1.8rem' }}>Consumption Analytics</h2>
              </div>

              <div className="tab-group" style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '5px', borderRadius: '12px' }}>
                <button 
                  className={`tab-item ${chartPeriod === 'daily' ? 'active' : ''}`} 
                  onClick={() => setChartPeriod('daily')}
                >Daily Usage</button>
                <button 
                  className={`tab-item ${chartPeriod === 'monthly' ? 'active' : ''}`} 
                  onClick={() => setChartPeriod('monthly')}
                >Monthly Usage </button>
              </div>
            </div>
           <div className="chart-body" style={{ width: '100%', height: '400px', overflow: 'hidden' }}>
  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={400}>
    <AreaChart
      data={chartPeriod === 'daily' ? data.daily : data.monthly}
      margin={{ top: 10, right: 35, left: -20, bottom: 0 }}
    >
      <defs>
        <linearGradient id="colorC" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="var(--primary-cyan)" stopOpacity={0.3}/>
          <stop offset="95%" stopColor="var(--primary-cyan)" stopOpacity={0}/>
        </linearGradient>
      </defs>

      <CartesianGrid 
        strokeDasharray="3 3" 
        stroke="rgba(255,255,255,0.1)" 
        vertical={true} 
        horizontal={true} 
      />

      <XAxis 
        dataKey="name" 
        stroke="#94a3b8" 
        axisLine={{ stroke: 'rgba(255,255,255,0.2)' }} 
        tickLine={false} 
        tick={{ fontSize: 12 }}
      />
      <YAxis 
        stroke="#94a3b8" 
        axisLine={{ stroke: 'rgba(255,255,255,0.2)' }} 
        tickLine={false} 
        tick={{ fontSize: 12 }}
      />

      <Tooltip 
        contentStyle={{ background: 'var(--bg-dark)', border: '1px solid var(--primary-cyan)', borderRadius: '12px' }} 
      />

      <Area 
        type="monotone" 
        dataKey="liters" 
        stroke="var(--primary-cyan)" 
        fill="url(#colorC)" 
        strokeWidth={3} 
        dot={{ fill: 'var(--primary-cyan)', r: 4 }}
      />
    </AreaChart>
  </ResponsiveContainer>
</div>

              
          </div>
        )}
      </main>
    </div>
  );
};

export default SmartDashboard;
