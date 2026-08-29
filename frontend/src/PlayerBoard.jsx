import { useEffect, useState } from 'react';
import { api } from './lib/api';

export default function PlayerBoard({ roomCode }) {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!roomCode) return undefined;
    let active = true;
    const load = () => api.getRoom(roomCode)
      .then(({ room: next }) => active && setRoom(next))
      .catch((reason) => active && setError(reason.message));
    load();
    const timer = setInterval(load, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [roomCode]);

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <span className="kicker">Sponsio room {roomCode}</span>
          <h1 className="title-gradient">Player Board</h1>
        </div>
        <span className="chip">{room?.playerCount || 0} / {room?.capacity || 100} profiles</span>
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="glass board-card">
        <div className="entries">
          {(room?.leaderboard || []).map((profile, index) => (
            <div className={`entry ${index === 0 ? 'rank-1' : ''}`} key={profile.address}>
              <div className="entry-rank">#{index + 1}</div>
              <div className="entry-names">
                <div className="entry-name">{profile.username}</div>
                <div className="entry-story">{profile.description}</div>
              </div>
              <div className="entry-stats">
                <div className="entry-stat"><div className="k">Headcount</div><div className="v">{profile.headCount}</div></div>
                <div className="entry-stat"><div className="k">Equity</div><div className="v">{profile.totalActiveEquity}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
