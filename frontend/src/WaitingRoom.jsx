import { useEffect, useRef, useState } from 'react';

const STALL_SECONDS = 18; // fall back if no one new joins for this long

function useRoom({ joinedCount = 1, limit = 8 } = {}) {
  const [count, setCount] = useState(joinedCount); // you are the 1st player in the room
  const [online, setOnline] = useState(null); // null=checking, true/false
  const [stall, setStall] = useState(0);      // consecutive seconds count has been static

  // 1. arrive driver (live poll; falls back to a demo simulator when offline)
  const onlineRef = useRef(online);
  useEffect(() => { onlineRef.current = online; }, [online]);
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch('http://localhost:3001/room', { cache: 'no-store' });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (cancelled) return;
        onlineRef.current = true;
        setOnline(true);
        setStall(0);
        setCount(data.count ?? 0);
      } catch {
        if (cancelled) return;
        onlineRef.current = false;
        setOnline(false); // demo mode — backend offline
      }
    };
    poll();
    const pollIv = setInterval(poll, 2000);
    // demo simulator (only counts up while the backend is offline)
    const sim = setInterval(() => {
      if (onlineRef.current === false) {
        setCount((c) => (c >= limit ? c : c + 1)); // deterministic fill for reliable demo
      }
    }, 2000);
    return () => { cancelled = true; clearInterval(pollIv); clearInterval(sim); };
  }, [limit]);

  // 2. stall timer — a real 1s tick that resets whenever count grows
  const lastCount = useRef(count);
  useEffect(() => {
    const iv = setInterval(() => {
      setCount((cur) => {
        if (cur !== lastCount.current) {
          lastCount.current = cur;   // it changed — reset the clock
          setStall(0);
        } else {
          setStall((s) => s + 1);    // static — keep counting
        }
        return cur;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  return { count, online, stall };
}

export default function WaitingRoom({ username, limit = 8, onFull, onFallback }) {
  const { count, online, stall } = useRoom({ limit });
  const pct = Math.min(100, (count / limit) * 100);
  const remaining = limit - count;
  const closing = Math.max(0, STALL_SECONDS - stall);
  const filled = Array.from({ length: limit }).map((_, i) => i < count);

  // when room fills -> launch game
  useEffect(() => {
    if (count >= limit) {
      const t = setTimeout(onFull, 900);
      return () => clearTimeout(t);
    }
  }, [count, limit, onFull]);

  // fallback: stalled too long & still not full -> send the player back
  useEffect(() => {
    if (online === false && count < limit && stall >= STALL_SECONDS) {
      onFallback('No new players joined. Room closed.');
    }
  }, [stall, count, online, limit, onFallback]);

  return (
    <div className="room">
      <span className="demo-tag">
        {online === false ? 'DEMO · simulated queue' : 'LIVE ROOM'}
      </span>

      <div className="room-hud screen-enter">
        <div className="room-title">Waiting room</div>
        <div className="room-count">
          <b>{count}</b> / {limit}
        </div>
        <p className="room-sub">
          {remaining > 0
            ? `${remaining} more ${remaining === 1 ? 'player' : 'players'} to begin the arena. Spread the word — the room closes if nobody shows.`
            : 'Room full — booting up the arena…'}
        </p>
        <div className="bar">
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="queue-dots">
          {filled.map((f, i) => (
            <span key={i} className={`qdot ${f ? 'filled' : ''}`}>{i + 1}</span>
          ))}
        </div>
        {online === false && count < limit && (
          <div className="room-status">⚠ No new arrivals · closing in {closing}s</div>
        )}
        <div className="room-hint">INSERT COIN — players are filling the lobby</div>
      </div>
    </div>
  );
}
