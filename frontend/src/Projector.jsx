import { useState, useEffect } from 'react';

export default function Projector() {
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
    <div className="projector-view animate-fade-in" style={{ padding: '4rem 2rem' }}>
      <h1 className="title-gradient" style={{ textAlign: 'center', fontSize: '4rem', marginBottom: '4rem' }}>
        BlitzConsensus Live
      </h1>

      <div className="leaderboard-list">
        {playerList.map((p, idx) => (
          <div key={p.address} className={`leaderboard-item rank-${idx + 1}`}>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
              <div className="rank-badge">#{idx + 1}</div>
              <div className="player-info">
                <h3 className="title-gradient">{p.username}</h3>
              </div>
            </div>
            
            <div className="stats-group">
              <div>
                <div className="stat-label">Headcount</div>
                <div className="stat-val">{Math.floor(Math.random() * 50)}</div>
              </div>
              <div>
                <div className="stat-label">Active Equity</div>
                <div className="stat-val">{Math.floor(Math.random() * 10000)}</div>
              </div>
            </div>
          </div>
        ))}
        {playerList.length === 0 && (
          <h2 style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Awaiting combatants...</h2>
        )}
      </div>
    </div>
  );
}
