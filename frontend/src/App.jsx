import { useState } from 'react';
import Landing from './Landing';
import Onboarding from './Onboarding';
import WaitingRoom from './WaitingRoom';
import GameWindow from './GameWindow';
import FinalScreen from './FinalScreen';
import ArcadeBackdrop from './ArcadeBackdrop';

export default function App() {
  const [view, setView] = useState('landing');
  const [player, setPlayer] = useState(null);
  const [settlement, setSettlement] = useState({
    split: 0,
    backedWinner: false,
    winnerName: '',
    yourE: 0,
    yourL: 1,
    yourTT: 1,
    totalWinningEquity: 0,
    pool: 8000,
  });
  const [txn, setTxn] = useState(null); // { phase:'in'|'out', to, data }

  // run a creative transition (wipe) between views
  const goto = (to) => {
    if (to === view) return;
    setTxn({ phase: 'out', to });
    // out wipe plays (0.5s), then swap and play 'in'
    setTimeout(() => {
      setView(to);
      setTxn({ phase: 'in', to });
      setTimeout(() => setTxn(null), 650);
    }, 500);
  };

  // reset on each run for a fresh spin
  const startRun = () => {
    setSettlement({
      split: 0,
      backedWinner: false,
      winnerName: '',
      yourE: 0,
      yourL: 1,
      yourTT: 1,
      totalWinningEquity: 0,
      pool: 8000,
    });
    goto('onboarding');
  };

  const handleOnboardDone = (me) => {
    setPlayer(me);
    goto('waiting');
  };

  const handleWaiting = {
    onFull: () => goto('game'),
    onFallback: () => goto('onboarding'),
  };

  const handleGameEnd = ({ earnings, backedWinner, winnerName, yourE, yourL, yourTT, totalWinningEquity, pool }) => {
    setSettlement({
      split: earnings || 0,
      backedWinner: !!backedWinner,
      winnerName: winnerName || 'the leader',
      yourE: yourE || 0,
      yourL: yourL != null ? yourL : 1,
      yourTT: yourTT != null ? yourTT : 1,
      totalWinningEquity: totalWinningEquity || 0,
      pool: pool || 8000,
    });
    goto('final');
  };

  const GAME_MAP = {
    landing: 'breakout',
    onboarding: 'tetris',
    waiting: 'pong',
    game: 'snake',
    final: 'invaders',
  };

  return (
    <>
      {/* arcade backdrop — each page gets a different classic game */}
      <ArcadeBackdrop variant={GAME_MAP[view] || 'breakout'} />
      <div className="pixel-grid" />

      <div className="screen-stage">
        {view === 'landing' && <Landing onStart={startRun} />}
        {view === 'onboarding' && <Onboarding onDone={handleOnboardDone} />}
        {view === 'waiting' && <WaitingRoom username={player?.username} {...handleWaiting} />}
        {view === 'game' && <GameWindow me={player} onGameEnd={handleGameEnd} />}
        {view === 'final' && (
          <FinalScreen
            me={player}
            earnings={settlement.split}
            backedWinner={settlement.backedWinner}
            winnerName={settlement.winnerName}
            yourE={settlement.yourE}
            yourL={settlement.yourL}
            yourTT={settlement.yourTT}
            totalWinningEquity={settlement.totalWinningEquity}
            pool={settlement.pool}
            onPlayAgain={startRun}
            onHome={() => goto('landing')}
          />
        )}
      </div>

      {/* creative wipe transition overlay */}
      {txn && (
        <div className={`txn ${txn.phase}`}>
          <div className="txn-bar" />
          <div className="txn-bar" />
          <div className="txn-bar" />
          <div className="txn-bar" />
        </div>
      )}
    </>
  );
}
