import { roomCapacityState } from './lib/roomState';

export default function WaitingRoom({
  room,
  roomCode,
  connection,
  isHost,
  onStart,
  onLeave,
}) {
  const { count, capacity, percent: pct } = roomCapacityState(room);
  const countdown = room?.status === 'countdown' && room.startAt
    ? Math.max(0, Math.ceil((room.startAt - (room.serverNow || room.startAt)) / 1000))
    : null;

  const copyInvite = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomCode);
    navigator.clipboard.writeText(url.toString());
  };

  return (
    <div className="room">
      <span className="demo-tag">
        {connection === 'connected' ? '● LIVE · MONAD TESTNET' : connection.toUpperCase()}
      </span>

      <div className="room-hud screen-enter">
        <div className="room-title">Room code</div>
        <button className="room-code" onClick={copyInvite} title="Copy invite link">
          {roomCode}
        </button>
        <div className="room-count">
          <b>{count}</b> / {capacity}
        </div>
        <p className="room-sub">
          {count < 2
            ? 'Waiting for one more wallet. Share the room code to invite players.'
            : countdown != null
              ? `Arena launches in ${countdown}…`
              : `${count} real players are ready. The host can launch at any size up to 100.`}
        </p>
        <div className="bar">
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>

        <div className="roster-list">
          {(room?.players || []).map((player) => (
            <span className="roster-player" key={player.address} title={player.address}>
              {player.username}
            </span>
          ))}
        </div>

        {isHost && room?.status === 'lobby' && (
          <button className="btn-primary" disabled={count < 2} onClick={onStart} style={{ width: '100%' }}>
            START WITH {count} PLAYERS
          </button>
        )}
        {!isHost && room?.status === 'lobby' && (
          <div className="room-status">WAITING FOR HOST TO START</div>
        )}
        <button className="btn-ghost" onClick={onLeave} style={{ width: '100%', marginTop: '0.7rem' }}>
          LEAVE ROOM
        </button>
        <div className="room-hint">Every profile is another real player in this room</div>
      </div>
    </div>
  );
}
