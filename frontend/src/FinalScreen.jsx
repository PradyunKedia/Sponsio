import { useEffect, useState } from 'react';

function Confetti() {
  const [pieces, setPieces] = useState([]);
  useEffect(() => {
    const colors = ['#7B68EE', '#FF6B81', '#3fb98a', '#e07a3c', '#c46bd8', '#ffd700'];
    const p = Array.from({ length: 42 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: colors[i % colors.length],
      size: 6 + Math.random() * 8,
      delay: Math.random() * 0.4,
      dur: 2 + Math.random() * 1.5,
      rot: Math.random() * 360,
    }));
    setPieces(p);
  }, []);

  return (
    <div className="confetti-field" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: `${p.size}px`,
            height: `${p.size * 0.6}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export default function FinalScreen({
  me, earnings, backedWinner, winnerName, yourE, yourL, yourTT, totalWinningEquity, pool = 8000, onPlayAgain, onHome,
}) {
  const pct = !backedWinner || totalWinningEquity <= 0
    ? 0
    : Math.max(0.02, Math.min(1, yourE / totalWinningEquity));
  const r = 82;
  const circ = 2 * Math.PI * r;

  return (
    <div className="final">
      <Confetti />
      <div className="final-inner screen-enter">
        <div className="result-ring">
          <svg viewBox="0 0 200 200">
            <circle className="ring-bg" cx="100" cy="100" r={r} />
            <circle
              className="ring-bar"
              cx="100"
              cy="100"
              r={r}
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - pct)}
            />
          </svg>
          <div className="result-circle">
            <div className="sum">{Math.round(pct * 100)}%</div>
            <div className="lab">OF POOL</div>
          </div>
        </div>

        <div className="final-title">
          {backedWinner
            ? `YOU BACKED ${winnerName || 'THE CHAMPION'}!`
            : `${winnerName || 'THE LEADER'} WON`}
        </div>
        <div className="final-earned">
          + {earnings.toLocaleString()} <b>$MON</b>
        </div>
        <p className="final-sub">
          {backedWinner
            ? `Your initial stake gave you ${yourE.toLocaleString()} effective equity (${(yourL * 100).toFixed(0)}% loyalty × ${(yourTT * 100).toFixed(0)}% time term) out of ${totalWinningEquity.toLocaleString()} total winning equity.`
            : `You backed a runner-up. Only backers of the winning profile split the ${pool.toLocaleString()} $MON escrowed pool.`}
        </p>

        <div className="final-actions">
          <button className="btn-primary" style={{ width: '100%' }} onClick={onPlayAgain}>
            PLAY AGAIN
          </button>
          <button className="btn-ghost" style={{ width: '100%', marginTop: '0.7rem' }} onClick={onHome}>
            BACK TO HOME
          </button>
        </div>
      </div>
    </div>
  );
}
