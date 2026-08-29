import { useCallback, useEffect, useState } from 'react';
import Landing from './Landing';
import Onboarding from './Onboarding';
import WaitingRoom from './WaitingRoom';
import GameWindow from './GameWindow';
import FinalScreen from './FinalScreen';
import ArcadeBackdrop from './ArcadeBackdrop';
import useRoomSocket from './hooks/useRoomSocket';
import { api } from './lib/api';
import { parseStoredSession } from './lib/roomState';

const SESSION_KEY = 'sponsio-room-session';

function restoredSession() {
  return parseStoredSession(sessionStorage.getItem(SESSION_KEY));
}

export default function App() {
  const [saved] = useState(() => restoredSession());
  const [view, setView] = useState(saved.token ? 'waiting' : 'landing');
  const [roomCode, setRoomCode] = useState(
    saved.roomCode || new URLSearchParams(window.location.search).get('room')?.toUpperCase() || '',
  );
  const [player, setPlayer] = useState(saved.player || null);
  const [token, setToken] = useState(saved.token || '');
  const [chainConfig, setChainConfig] = useState(null);
  const [appError, setAppError] = useState('');
  const [txn, setTxn] = useState(null);
  const { room, connection, error: socketError, clearError, switchProfile } = useRoomSocket(
    roomCode,
    token,
    player?.wallet,
  );

  useEffect(() => {
    api.config().then(setChainConfig).catch((error) => setAppError(error.message));
  }, []);

  const goto = useCallback((to) => {
    if (to === view) return;
    setTxn({ phase: 'out', to });
    setTimeout(() => {
      setView(to);
      setTxn({ phase: 'in', to });
      setTimeout(() => setTxn(null), 650);
    }, 500);
  }, [view]);

  useEffect(() => {
    if (!room || txn) return;
    // View changes intentionally follow authoritative room phase changes.
    // oxlint-disable-next-line react/set-state-in-effect
    if (room.status === 'live' && view !== 'game') goto('game');
    // oxlint-disable-next-line react/set-state-in-effect
    if (room.status === 'settled' && view !== 'final') goto('final');
    if ((room.status === 'lobby' || room.status === 'countdown') && !['waiting', 'onboarding'].includes(view)) {
      // oxlint-disable-next-line react/set-state-in-effect
      goto('waiting');
    }
  }, [goto, room, txn, view]);

  const selectRoom = async (code) => {
    setAppError('');
    const normalized = code.toUpperCase();
    await api.getRoom(normalized);
    setRoomCode(normalized);
    window.history.replaceState({}, '', `?room=${normalized}`);
    goto('onboarding');
  };

  const createRoom = async () => {
    setAppError('');
    try {
      const { room: created } = await api.createRoom();
      await selectRoom(created.code);
    } catch (error) {
      setAppError(error.message);
    }
  };

  const joinRoom = async (code) => {
    try {
      await selectRoom(code);
    } catch (error) {
      setAppError(error.message);
    }
  };

  const handleOnboardDone = ({ player: joinedPlayer, token: sessionToken }) => {
    setPlayer(joinedPlayer);
    setToken(sessionToken);
    const session = { roomCode, player: joinedPlayer, token: sessionToken };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    goto('waiting');
  };

  const goHome = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setToken('');
    setPlayer(null);
    setRoomCode('');
    window.history.replaceState({}, '', window.location.pathname);
    goto('landing');
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
      <ArcadeBackdrop variant={GAME_MAP[view] || 'breakout'} />
      <div className="pixel-grid" />
      {(appError || socketError || connection === 'reconnecting') && (
        <div className="connection-banner" onClick={clearError}>
          {connection === 'reconnecting' ? 'RECONNECTING TO ARENA…' : appError || socketError}
        </div>
      )}

      <div className="screen-stage">
        {view === 'landing' && (
          <Landing onCreate={createRoom} onJoin={joinRoom} error={appError} />
        )}
        {view === 'onboarding' && (
          <Onboarding
            roomCode={roomCode}
            chainConfig={chainConfig}
            onDone={handleOnboardDone}
          />
        )}
        {view === 'waiting' && (
          <WaitingRoom
            room={room}
            roomCode={roomCode}
            connection={connection}
            isHost={room?.hostAddress === player?.wallet}
            onStart={() => api.startRoom(roomCode, token).catch((error) => setAppError(error.message))}
            onLeave={goHome}
          />
        )}
        {view === 'game' && (
          <GameWindow
            me={player}
            room={room}
            connection={connection}
            onSwitch={switchProfile}
          />
        )}
        {view === 'final' && (
          <FinalScreen
            me={player}
            room={room}
            chainConfig={chainConfig}
            onPlayAgain={goHome}
            onHome={goHome}
          />
        )}
      </div>

      {txn && (
        <div className={`txn ${txn.phase}`}>
          <div className="txn-bar" />
          <div className="txn-bar" />
          <div className="txn-bar" />
          <div className="txn-sweep" />
        </div>
      )}
    </>
  );
}
