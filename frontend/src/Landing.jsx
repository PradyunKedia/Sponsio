import { useState } from 'react';

export default function Landing({ onCreate, onJoin, error }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="landing">
      <div className="logo-block screen-enter">
        <div className="logo-slant">SPONSIO</div>
        <span className="logo-sub">MONAD TESTNET ARCADE</span>
        <div className="logo-platform screen-enter d1">
          <span className="on">● MULTIPLAYER</span>
          <span className="gold">2–100 PLAYERS</span>
          <span>MONAD TESTNET</span>
        </div>
      </div>

      <div className="start-wrap screen-enter d2">
        <button className="btn-arcade" onClick={() => run(onCreate)} disabled={busy}>
          {busy ? 'CREATING…' : '▶ CREATE ROOM'}
        </button>
        <div className="room-join">
          <input
            className="input"
            value={code}
            maxLength={6}
            placeholder="ROOM CODE"
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && code.length >= 4) run(() => onJoin(code));
            }}
          />
          <button
            className="btn-ghost"
            disabled={busy || code.length < 4}
            onClick={() => run(() => onJoin(code))}
          >
            JOIN
          </button>
        </div>
        {error && <div className="error-box">{error}</div>}
      </div>

      <div className="landing-feet">
        <span>STAKE TESTNET MON</span>
        <span>100 SECOND ROUNDS</span>
        <span>© SPONSIO</span>
      </div>
    </div>
  );
}
