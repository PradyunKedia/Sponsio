import { useState } from 'react';

export default function Register({ onSuccess, onSwitchToProjector }) {
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!address || !description) return setError('All fields required');
    
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, description })
      });
      const data = await res.json();
      if (data.success) {
        onSuccess(address);
      } else {
        setError('Registration failed');
      }
    } catch (err) {
      setError('Server error. Is the backend running?');
    }
    setLoading(false);
  };

  return (
    <div className="flex-center" style={{ minHeight: '80vh' }}>
      <div className="glass-panel animate-fade-in" style={{ maxWidth: '500px', width: '100%' }}>
        <h1 className="title-gradient" style={{ textAlign: 'center', marginBottom: '2rem' }}>BlitzConsensus</h1>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Wallet Address</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="0x..." 
              value={address} 
              onChange={e => setAddress(e.target.value)} 
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
              The craziest/boldest thing you've done
            </label>
            <textarea 
              className="input-field" 
              rows="4"
              placeholder="Tell us a story to generate your AI username..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {error && <p style={{ color: 'var(--secondary)' }}>{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'AI Generating Username...' : 'Enter the Arena'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button className="btn-secondary" onClick={onSwitchToProjector}>
            Open Projector View
          </button>
        </div>
      </div>
    </div>
  );
}
