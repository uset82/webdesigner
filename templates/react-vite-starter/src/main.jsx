import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './main.css';
import { Sparkles, LayoutGrid, Zap, Shield, HelpCircle, ArrowRight } from 'lucide-react';

function App() {
  const [vibe, setVibe] = useState('saas');
  const [density, setDensity] = useState('medium');

  useEffect(() => {
    // Sync body classes
    const body = document.body;
    body.className = ''; // Reset
    body.classList.add(`vibe-${vibe}`);
    body.classList.add(`density-${density}`);
  }, [vibe, density]);

  return (
    <div>
      {/* Top Navbar */}
      <header style={{
        height: '80px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 var(--layout-padding)',
        borderBottom: '1px solid var(--border-base)',
        backgroundColor: 'var(--bg-surface)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sparkles style={{ color: 'var(--brand-accent)' }} />
          <span style={{ fontWeight: 800, fontSize: '1.25rem', fontFamily: 'var(--font-display)' }}>WebDesigner</span>
        </div>

        {/* Dynamic Controls */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginRight: '8px' }}>VIBE:</span>
            <select 
              value={vibe} 
              onChange={(e) => setVibe(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-surface-bright)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-base)',
                fontSize: '0.9rem'
              }}
            >
              <option value="saas">SaaS (Default)</option>
              <option value="minimalist">Minimalist</option>
              <option value="editorial">Editorial</option>
              <option value="brutalist">Brutalist</option>
              <option value="retro-futuristic">Retro-Futuristic</option>
              <option value="soft">Soft Clay</option>
            </select>
          </div>

          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginRight: '8px' }}>DENSITY:</span>
            <select 
              value={density} 
              onChange={(e) => setDensity(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-surface-bright)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-base)',
                fontSize: '0.9rem'
              }}
            >
              <option value="low">Low (Spacious)</option>
              <option value="medium">Medium</option>
              <option value="high">High (Compact)</option>
            </select>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <h1 style={{ fontSize: '3.5rem', marginBottom: '1.5rem', maxWidth: '800px' }}>
          Next-Generation Web Layouts Powered by WebDesigner
        </h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', marginBottom: '2.5rem', maxWidth: '600px' }}>
          Establish custom dial values for Variance, Motion, and Density to steer UI development directly.
        </p>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button className="btn btn-primary">
            Get Started <ArrowRight size={16} style={{ marginLeft: '8px' }} />
          </button>
          <button className="btn btn-secondary">Documentation</button>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container">
        <h2 style={{ fontSize: '2.25rem', marginBottom: '2rem', textAlign: 'center' }}>Orchestrated Stages</h2>
        <div className="grid">
          <div className="card">
            <LayoutGrid style={{ color: 'var(--brand-accent)', marginBottom: '1rem' }} size={32} />
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>1. Planning & Intent</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              Evaluate requirements, select the stack catalog targets, and register them in the manifest.
            </p>
          </div>
          <div className="card">
            <Zap style={{ color: 'var(--brand-accent)', marginBottom: '1rem' }} size={32} />
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>2. Design Steering</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              Commit to aesthetic vibes and steer layouts using dynamic density and spacing dials.
            </p>
          </div>
          <div className="card">
            <Shield style={{ color: 'var(--brand-accent)', marginBottom: '1rem' }} size={32} />
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>3. Build & Audit</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              Scaffold directories, build components, perform automated security threat audits.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        marginTop: '5rem',
        padding: '3rem var(--layout-padding)',
        borderTop: '1px solid var(--border-base)',
        backgroundColor: 'var(--bg-surface)',
        textAlign: 'center'
      }}>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
          © {new Date().getFullYear()} WebDesigner Core. Built dynamically.
        </p>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
