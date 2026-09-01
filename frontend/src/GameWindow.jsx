import { useEffect, useMemo, useRef, useState } from 'react';
import SevenSeg from './SevenSeg';
import ArcadeConsole from './ArcadeConsole';

const GAME_SECONDS = 100;
const V0 = 1000; // permanent voting weight per participant

function fmt(t) {
  if (t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function backerFont(rank) {
  if (rank === 1) return 'clamp(1.7rem, 3.5vw, 2.5rem)';
  if (rank === 2) return 'clamp(1.3rem, 3vw, 1.95rem)';
  if (rank === 3) return 'clamp(1.05rem, 2.5vw, 1.55rem)';
  return 'clamp(0.9rem, 2vw, 1.2rem)';
}

// Loyalty Curve L(s) — the proportion of the original stake that stays active.
const LOYALTY = (s) => (s <= 0 ? 1.00 : s === 1 ? 0.85 : s === 2 ? 0.60 : s === 3 ? 0.40 : 0.15);
// Soft Time-Decay T(t) — 1.00 → 0.80 over the 100s window.
const TDECAY = (t) => Math.max(0.80, 1.00 - 0.002 * t);
// Active Equity + Effective Claim
const A_EQ = (s) => V0 * LOYALTY(s);                       // A_i
const E_EQ = (s, t) => A_EQ(s) * TDECAY(t);                // E_i = A_i × T(t)

const SEEDS = [
  { id: 'p1', name: 'GLITCH_KID', project: 'SplitDB', cat: 'INFRABASE',
    pitch: 'A fault-tolerant NoSQL DB that recovered from a 5-node split-brain live on stage.',
    bio: 'Built for a CTO of a fintech scaleup. Survived a live failover demo with zero downtime and celebrated round after round.',
    color: '#7B68EE' },
  { id: 'p2', name: '8BIT_BANANA', project: 'Pixel Punch', cat: 'GAMEDEV',
    pitch: 'Onchain arcade games with sub-100ms moves settled straight to L1. Demonstrates real-time play.',
    bio: 'Turned WebSocket netcode into onchain moves. Aim: prove Monad handles arcade-speed gameplay without a server.',
    color: '#FF6B81' },
  { id: 'p3', name: 'MOON_WALKER', project: 'MoonScope', cat: 'DEVTOOLS',
    pitch: 'A zk-rollup block explorer with a custom circuit visualizer. Made zk approachable.',
    bio: 'Wanted to see inside proofs. Rendered circuit constraints as an interactive graph for the whole community.',
    color: '#e07a3c' },
  { id: 'p4', name: 'ZERO_FX', project: 'ZeroFX', cat: 'DEFI',
    pitch: 'A flash-loan arbitrage engine netting 2.3% per bundle across 4 DEXes.',
    bio: 'Chasing edge, atomically. Backtested 40k pairs, then made it gas-lean enough to actually run.',
    color: '#c46bd8' },
  { id: 'p5', name: 'PIXEL_PILOT', project: 'CanvasPlex', cat: 'REALTIME',
    pitch: 'Realtime canvas multiplayer with 60fps synced drawing for 1,000 concurrent users.',
    bio: 'Deleted the "you drew it" lag. CRDT film over a shared canvas, tuned to the frame.',
    color: '#3fb98a' },
  { id: 'p6', name: 'QWERTY_HERO', project: 'PromptForge', cat: 'AI',
    pitch: 'An AI vibe-coding IDE that turns English into deployable contracts.',
    bio: 'Pointed an LLM at Solidity and added safety rails, tests, and an audit pass to the loop.',
    color: '#5e8be0' },
  { id: 'p7', name: 'SHADOW_ROUTE', project: 'MistVault', cat: 'PRIVACY',
    pitch: 'A shuffle-based dark pool that hides order flow from MEV bots entirely.',
    bio: 'Privacy by topology, not just by name. Shuffled intents so searchers see nothing actionable.',
    color: '#2e9e58' },
];

export default function GameWindow({ me, onGameEnd }) {
  const [seconds, setSeconds] = useState(GAME_SECONDS);
  const [bots, setBots] = useState([]);
  const [vote, setVote] = useState(() => 'p1');        // profile id you back (starts backing p1)
  const [selected, setSelected] = useState(null);
  const [yourS, setYourS] = useState(0);         // your switch count
  const [yourT, setYourT] = useState(0);         // clock of your last switch
  const secondsRef = useRef(seconds);
  secondsRef.current = seconds;
  const elapsed = GAME_SECONDS - seconds;

  const myProfile = useMemo(() => (me ? {
    id: 'me', name: me.username || 'YOU', project: 'YOUR PICK', cat: 'YOU',
    pitch: 'Your proudest build, live.',
    bio: me.desc || 'The project you stake your reputation on.',
    mine: true, color: '#2e9e58',
  } : null), [me]);

  const profiles = useMemo(() => (myProfile ? [myProfile, ...SEEDS] : SEEDS), [myProfile]);
  const L = profiles.length;
  const POOL = L * V0;

  const targets = useMemo(() => {
    const arr = Array(L).fill(0);
    if (L <= 1) {
      arr[0] = 0;
    } else if (L % 2 === 0) {
      for (let k = 0; k < L / 2; k++) {
        arr[2 * k] = 2 * k + 1;
        arr[2 * k + 1] = 2 * k;
      }
    } else {
      for (let k = 0; k < (L - 3) / 2; k++) {
        arr[2 * k] = 2 * k + 1;
        arr[2 * k + 1] = 2 * k;
      }
      arr[L - 3] = L - 2;
      arr[L - 2] = L - 1;
      arr[L - 1] = L - 3;
    }
    return arr;
  }, [L]);

  // Seed bots: paired-vote setup where everyone starts with exactly 1 backer
  useEffect(() => {
    if (L <= 1) return;
    const arr = Array.from({ length: L - 1 }).map((_, idx) => {
      const profileIndex = idx + 1;
      const targetIndex = targets[profileIndex];
      return { tid: targetIndex, s: 0, t: 0 };
    });
    setBots(arr);

    // bots drift over time (live feel): a bot occasionally switches targets
    const iv = setInterval(() => {
      setBots((prev) => {
        if (prev.length === 0) return prev;
        const next = prev.map((b) => ({ ...b }));
        const i = Math.floor(Math.random() * next.length);
        const newTid = Math.floor(Math.random() * L);
        if (newTid !== next[i].tid) {
          next[i] = { ...next[i], tid: newTid, s: next[i].s + 1, t: Math.min(100, GAME_SECONDS - secondsRef.current) };
        }
        return next;
      });
    }, 2200);
    return () => clearInterval(iv);
  }, [L, targets]);

  // countdown
  useEffect(() => {
    if (seconds <= 0) return;
    const iv = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(iv);
  }, [seconds]);

  // aggregate: backers (unique voters) + sum of Effective Equity per profile
  const board = useMemo(() => {
    const byId = {};
    profiles.forEach((p) => { byId[p.id] = { backers: 0, E: 0, A: 0 }; });
    bots.forEach((b) => {
      const pid = profiles[b.tid].id;
      byId[pid].backers += 1;
      byId[pid].E += E_EQ(b.s, b.t);
      byId[pid].A += A_EQ(b.s);
    });
    if (vote) {
      byId[vote].backers += 1;
      byId[vote].E += E_EQ(yourS, yourT);   // time term is locked to your last switch time
      byId[vote].A += A_EQ(yourS);
    }
    return byId;
  }, [profiles, bots, vote, yourS, yourT]);

  const entries = useMemo(() => profiles.map((p) => ({
    ...p,
    backers: board[p.id].backers,
    E: Math.round(board[p.id].E),
  })).sort((a, b) => b.backers - a.backers || b.E - a.E), [profiles, board]);

  // Winner: most backers; tie-break by summed Active Equity.
  const winner = useMemo(() => {
    if (seconds > 0) return null;
    const maxBackers = Math.max(...entries.map((e) => e.backers));
    const tied = entries.filter((e) => e.backers === maxBackers);
    return tied.sort((a, b) => board[b.id].A - board[a.id].A)[0] || null;
  }, [entries, board, seconds]);

  // Effective Equity YOUR original 1000 votes amount to (penalties included).
  const yourE = Math.round(E_EQ(yourS, yourT));
  const yourL = LOYALTY(yourS);
  const yourTT = TDECAY(yourT);

  // Settlement: pool splits ONLY among the winner's backers, pro-rata to E_i.
  const settleSplit = useMemo(() => {
    if (!winner) return 0;
    const backedWinner = vote === winner.id;
    if (!backedWinner) return 0;
    // total Effective Equity among winner's backers
    let sumE = 0;
    bots.forEach((b) => { if (profiles[b.tid].id === winner.id) sumE += E_EQ(b.s, b.t); });
    sumE += E_EQ(yourS, yourT);
    return sumE > 0 ? Math.round((E_EQ(yourS, yourT) / sumE) * POOL) : 0;
  }, [winner, vote, bots, yourS, yourT, profiles, POOL]);

  const totalVoted = (L - 1) + (vote ? 1 : 0);

  // when clock hits 0, settle
  useEffect(() => {
    if (seconds === 0) {
      let winningE = 0;
      if (winner) {
        bots.forEach((b) => { if (profiles[b.tid].id === winner.id) winningE += E_EQ(b.s, b.t); });
        if (vote === winner.id) {
          winningE += E_EQ(yourS, yourT);
        }
      }
      const t = setTimeout(() => onGameEnd({
        earnings: settleSplit,
        backedWinner: vote === winner?.id,
        winnerName: winner?.name,
        yourE,
        yourL,
        yourTT,
        totalWinningEquity: Math.round(winningE),
        pool: POOL,
      }), 900);
      return () => clearTimeout(t);
    }
  }, [seconds, settleSplit, winner, vote, yourE, yourL, yourTT, bots, profiles, yourS, yourT, POOL, onGameEnd]);

  // voting: switch to selected target
  const selectRow = (id) => setSelected((cur) => (cur === id ? null : id));
  const commitVote = () => {
    if (!selected || selected === vote) return;
    const isFirst = vote === null;
    setYourS((s) => (isFirst ? s : s + 1));
    setYourT(Math.min(100, elapsed));
    setVote(selected);
  };

  const selectedProfile = selected
    ? entries.find((e) => e.id === selected)
    : vote
      ? entries.find((e) => e.id === vote)
      : null;
  const selectedRank = selectedProfile
    ? entries.findIndex((e) => e.id === selectedProfile.id) + 1
    : null;

  // Joystick flick: react to moving up/down the leaderboard.
  const [flickDir, setFlickDir] = useState(0); // -1 up, +1 down, 0 rest
  const lastSelRank = useRef(selectedRank);
  useEffect(() => {
    const prev = lastSelRank.current;
    if (selectedRank != null && prev != null && selectedRank !== prev) {
      setFlickDir(selectedRank > prev ? 1 : -1); // lower row = down
      const t = setTimeout(() => setFlickDir(0), 260);
      lastSelRank.current = selectedRank;
      return () => clearTimeout(t);
    }
    lastSelRank.current = selectedRank;
  }, [selectedRank]);

  return (
    <div className="game screen-enter">
      <header className="game-top">
        <div className="game-brand">
          <span className="mark">S</span>
          <div>
            <div className="name">SPONSIO</div>
            <div className="sub">LIVE ARENA · MONAD</div>
          </div>
        </div>

        <div className="ticker">
          <div className="clock-label">TIME LEFT</div>
          <div className="led-wrap">
            <SevenSeg value={fmt(seconds)} className="led" />
          </div>
        </div>

        <div className="game-top-right">
          <span className="px-chip hot">● LIVE</span>
          <span className="px-chip">{totalVoted}/{L} VOTERS</span>
          <span className="px-chip gold" title={`Loyalty ×${yourL.toFixed(2)} · time ×${yourTT.toFixed(2)}`}>
            YOUR EQUITY <b>{yourE.toLocaleString()}</b>
          </span>
        </div>
      </header>

      <div className="game-body">
        {/* LEFT: leaderboard (wide) */}
        <section className="lb">
          <div className="lb-head">
            <span className="lb-title">Leaderboard</span>
            <span className="lb-live">LIVE</span>
          </div>
          <div className="lb-list">
            {entries.map((e, i) => {
              const rank = i + 1;
              const isVoted = vote === e.id;
              const isSel = selected === e.id;
              const isWinner = winner?.id === e.id;
              return (
                <div
                  key={e.id}
                  className={`lb-row rank-${rank}${e.mine ? ' mine' : ''}${isVoted ? ' voted' : ''}${isSel ? ' selected' : ''}${vote !== null && !isVoted ? ' dim' : ''}${isWinner ? ' champ' : ''}`}
                  onClick={() => selectRow(e.id)}
                >
                  <div className="lb-rank">{isWinner ? '🏆' : rank === 1 ? '★' : rank}</div>
                  <div className="lb-user">
                    <div className="lb-name">{e.mine ? `${e.name} (you)` : e.name}</div>
                    <div className="lb-pitch" title={e.pitch}>{e.pitch}</div>
                  </div>
                  <div className="lb-actions">
                    <div className="lb-backers" style={{ fontSize: backerFont(rank) }}>
                      {e.backers}
                      <small>VOTES</small>
                    </div>
                    {e.mine && <span className="lb-tag">YOU</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* RIGHT: profile (top) + controls (bottom) */}
        <div className="game-right">
          <section className="panel">
            {selectedProfile ? (
              <div className="profile-card screen-enter" key={selectedProfile.id}>
                <div className="pc-head">
                  <div className="pc-avatar" style={{ background: selectedProfile.color }}>
                    {selectedProfile.name[0]}
                  </div>
                  <div className="pc-title">
                    <span className="pc-name">{selectedProfile.mine ? `${selectedProfile.name} (you)` : selectedProfile.name}</span>
                    <span className="pc-project">{selectedProfile.project}</span>
                  </div>
                  {selectedProfile.mine
                    ? <span className="px-chip">YOU</span>
                    : (
                      <span className={`px-chip ${selectedProfile.id === vote ? 'gold' : 'hot'}`}>
                        {selectedProfile.id === vote ? '✓ VOTED' : `#${selectedRank}`}
                      </span>
                    )}
                </div>

                <div className="pc-backers">
                  <span className="pc-backers-num">{selectedProfile.backers}</span>
                  <span className="pc-backers-lab">UNIQUE BACKERS</span>
                </div>

                <span className="px-chip" style={{ alignSelf: 'flex-start' }}>{selectedProfile.cat}</span>

                <div className="pc-block">
                  <span className="pl">The pitch</span>
                  <p className="pc-text">{selectedProfile.pitch}</p>
                </div>
                <div className="pc-block">
                  <span className="pl">The story</span>
                  <p className="pc-text">{selectedProfile.bio}</p>
                </div>
              </div>
            ) : (
              <div className="profile-empty">
                <div className="pe-mark">👤</div>
                <span className="vs-kick">Player</span>
                <p className="pe-text">
                  Pick a build on the leaderboard to inspect it, then hit VOTE. Only the
                  winner's backers split the {POOL.toLocaleString()} pool pro-rata to equity.
                </p>
              </div>
            )}

            {selectedProfile && (
              <div className="live-tip">
                {vote
                  ? `You back ${entries.find((e) => e.id === vote)?.name} · ${yourE.toLocaleString()}/1k equity`
                  : 'Back a build — your 1,000 votes carry it.'}
              </div>
            )}
          </section>

          {/* CONTROLS: red VOTE circle + joystick */}
          <div className="controls">
            <button
              className={`red-btn ctl-vote${selectedProfile?.id === vote ? ' voted' : ''}`}
              onClick={commitVote}
              disabled={selectedProfile == null || selectedProfile.id === vote}
            >
              <span className="red-cap">VOTE</span>
            </button>
            <div className="ctl-joy">
              <ArcadeConsole dir={flickDir} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
