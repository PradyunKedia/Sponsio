import { useEffect, useState } from 'react';
import { api } from './lib/api';

export default function Projector({ roomCode: suppliedCode }) {
  const roomCode = suppliedCode || new URLSearchParams(window.location.search).get('room');
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!roomCode) return undefined;
    let active = true;
    const load = () => api.getRoom(roomCode)
      .then(({ room: next }) => active && setRoom(next))
      .catch((reason) => active && setError(reason.message));
    load();
    const timer = setInterval(load, 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [roomCode]);

  return (
    <div className="projector-view" style={{ padding: '4rem 2rem' }}>
      <h1 className="title-gradient" style={{ textAlign: 'center', fontSize: '3rem' }}>
        Sponsio Live · {roomCode || 'NO ROOM'}
      </h1>
      {error && <div className="error-box">{error}</div>}
      <div className="leaderboard-list">
        {(room?.leaderboard || []).map((profile, index) => (
          <div key={profile.address} className={`leaderboard-item rank-${index + 1}`}>
            <div className="rank-badge">#{index + 1}</div>
            <div className="player-info"><h3>{profile.username}</h3></div>
            <div className="stats-group">
              <div><div className="stat-label">Headcount</div><div className="stat-val">{profile.headCount}</div></div>
              <div><div className="stat-label">Active equity</div><div className="stat-val">{profile.totalActiveEquity}</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
