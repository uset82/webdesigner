import React from 'react';
import { Sparkles, Terminal, ShieldAlert, Cpu } from 'lucide-react';

export default function Home() {
  return (
    <main>
      {/* Hero Section */}
      <header className="hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
          <Sparkles style={{ color: 'var(--brand-accent)' }} size={24} />
          <span style={{ fontWeight: 800, fontSize: '1.25rem' }}>WEBDESIGNER CORE</span>
        </div>
        <h1 style={{ fontSize: '3.75rem', marginBottom: '1.5rem', maxWidth: '850px' }}>
          Server-Side Rendered Applications Made Elegant
        </h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', marginBottom: '2.5rem', maxWidth: '600px' }}>
          Generate responsive, performant, and secure Next.js templates that align with target visual identities.
        </p>
        <div style={{ display: 'flex', gap: '15px' }}>
          <a href="#" className="btn btn-primary">Get Started</a>
          <a href="#" className="btn btn-secondary">Explore Stack</a>
        </div>
      </header>

      {/* Structured Content */}
      <section className="container">
        <h2 style={{ fontSize: '2.25rem', marginBottom: '2.5rem', textAlign: 'center' }}>
          System Integrations
        </h2>
        <div className="grid">
          <div className="card">
            <Terminal style={{ color: 'var(--brand-accent)', marginBottom: '1rem' }} size={28} />
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Command-Line Engine</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              Run stack selection, routing checks, and record stages directly from your build environment.
            </p>
          </div>
          <div className="card">
            <Cpu style={{ color: 'var(--brand-accent)', marginBottom: '1rem' }} size={28} />
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>MCP Capability Router</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              Expose stage triggers to Cursor, Antigravity, and other development agents for automatic updates.
            </p>
          </div>
          <div className="card">
            <ShieldAlert style={{ color: 'var(--brand-accent)', marginBottom: '1rem' }} size={28} />
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Security Threat Auditing</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              Evaluate generated workspaces for vulnerabilities using sandbox checks and secure patch rules.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        marginTop: '6rem',
        padding: '3rem 2rem',
        borderTop: '1px solid var(--border-base)',
        backgroundColor: 'var(--bg-surface)',
        textAlign: 'center'
      }}>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
          Next.js WebDesigner Template. All Rights Reserved.
        </p>
      </footer>
    </main>
  );
}
