import { useState, useEffect } from 'react';

export default function PlayerBoard() {
  const [players, setPlayers] = useState({});

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const res = await fetch('http://localhost:3001/players');
        const data = await res.json();
        setPlayers(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchPlayers();
    const interval = setInterval(fetchPlayers, 2000);
    return () => clearInterval(interval);
  }, []);

  const playerList = Object.values(players);

  return (
    <div className="animate-fade-in">
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <h1 className="title-gradient">Player Board</h1>
        <div style={{ color: 'var(--text-muted)' }}>{playerList.length} Players Online</div>
      </div>

      <div className="leaderboard-list">
        {playerList.map((p, idx) => (
          <div key={p.address} className="leaderboard-item">
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <div className="rank-badge">#{idx + 1}</div>
              <div className="player-info">
                <h3>{p.username}</h3>
                <p title={p.description}>{p.description}</p>
              </div>
            </div>
            
            <div className="stats-group">
              <div>
                <div className="stat-label">Address</div>
                <div style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                  {p.address.slice(0,6)}...{p.address.slice(-4)}
                </div>
              </div>
              <button className="btn-secondary" style={{ whiteSpace: 'nowrap' }}>Switch to Profile</button>
            </div>
          </div>
        ))}
        {playerList.length === 0 && (
          <div className="glass-panel" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            No players have entered the arena yet.
          </div>
        )}
      </div>
    </div>
  );
}
