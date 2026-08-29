import { useEffect, useState } from 'react';
import SevenSeg from './SevenSeg';
import ArcadeConsole from './ArcadeConsole';

function formatTime(milliseconds) {
  const total = Math.max(0, Math.ceil((milliseconds || 0) / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export default function GameWindow({ me, room, connection, onSwitch }) {
  const [selected, setSelected] = useState(null);
  const [pendingProfile, setPendingProfile] = useState(null);
  const [actionError, setActionError] = useState('');
  const leaderboard = room?.leaderboard || [];
  const myState = room?.players?.find((player) => player.address === me?.wallet);
  const currentProfile = myState?.targetProfile;

  useEffect(() => {
    if (pendingProfile != null && currentProfile === pendingProfile) {
      // oxlint-disable-next-line react/set-state-in-effect
      setPendingProfile(null);
    }
  }, [currentProfile, pendingProfile]);

  const selectedProfile = leaderboard.find(
    (profile) => profile.profileIndex === (selected ?? currentProfile),
  );

  const commit = () => {
    if (selected == null || selected === currentProfile || pendingProfile != null) return;
    try {
      setActionError('');
      onSwitch(selected);
      setPendingProfile(selected);
    } catch (error) {
      setActionError(error.message);
    }
  };

  return (
    <div className="game screen-enter">
      <header className="game-top">
        <div className="game-brand">
          <span className="mark">S</span>
          <div>
            <div className="name">SPONSIO</div>
            <div className="sub">LIVE · MONAD TESTNET · {room?.code}</div>
          </div>
        </div>
        <div className="ticker">
          <div className="clock-label">SERVER TIME LEFT</div>
          <div className="led-wrap">
            <SevenSeg value={formatTime(room?.remainingMs)} />
          </div>
        </div>
        <div className="game-top-right">
          <span className={`px-chip ${connection === 'connected' ? 'hot' : ''}`}>
            {connection === 'connected' ? '● LIVE' : 'RECONNECTING'}
          </span>
          <span className="px-chip">{room?.playerCount || 0} VOTERS</span>
          <span className="px-chip gold">YOUR EQUITY {myState?.effectiveEquity ?? 1000}</span>
        </div>
      </header>

      <div className="game-body">
        <section className="lb">
          <div className="lb-head">
            <span className="lb-title">Real-time leaderboard</span>
            <span className="lb-live">AUTHORITATIVE</span>
          </div>
          <div className="lb-list">
            {leaderboard.map((profile, index) => {
              const backed = currentProfile === profile.profileIndex;
              const selectedNow = selected === profile.profileIndex;
              return (
                <button
                  type="button"
                  key={profile.address}
                  className={`lb-row rank-${index + 1}${backed ? ' voted' : ''}${selectedNow ? ' selected' : ''}`}
                  onClick={() => setSelected(profile.profileIndex)}
                >
                  <span className="lb-rank">{index === 0 ? '★' : index + 1}</span>
                  <span className="lb-user">
                    <span className="lb-name">
                      {profile.username}{profile.address === me?.wallet ? ' (you)' : ''}
                    </span>
                    <span className="lb-pitch">{profile.description}</span>
                  </span>
                  <span className="lb-actions">
                    <span className="lb-backers">
                      {profile.headCount}
                      <small>VOTES</small>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="game-right">
          <section className="panel">
            {selectedProfile ? (
              <div className="profile-card screen-enter" key={selectedProfile.address}>
                <div className="pc-head">
                  <div className="pc-avatar">{selectedProfile.username?.[0] || '?'}</div>
                  <div className="pc-title">
                    <span className="pc-name">{selectedProfile.username}</span>
                    <span className="pc-project">PROFILE #{selectedProfile.profileIndex + 1}</span>
                  </div>
                  <span className="px-chip hot">#{leaderboard.indexOf(selectedProfile) + 1}</span>
                </div>
                <div className="pc-backers">
                  <span className="pc-backers-num">{selectedProfile.headCount}</span>
                  <span className="pc-backers-lab">UNIQUE BACKERS</span>
                </div>
                <div className="pc-block">
                  <span className="pl">The pitch</span>
                  <p className="pc-text">{selectedProfile.description}</p>
                </div>
                <div className="pc-block">
                  <span className="pl">Active equity</span>
                  <p className="pc-stack">{selectedProfile.totalActiveEquity}</p>
                </div>
                {actionError && <div className="error-box">{actionError}</div>}
              </div>
            ) : (
              <div className="profile-empty">
                <div className="pe-mark">👤</div>
                <p className="pe-text">Select a real player profile, then commit your support.</p>
              </div>
            )}
          </section>

          <div className="controls">
            <button
              className="red-btn ctl-vote"
              onClick={commit}
              disabled={
                connection !== 'connected' ||
                selected == null ||
                selected === currentProfile ||
                pendingProfile != null
              }
            >
              <span className="red-cap">{pendingProfile != null ? 'WAIT' : 'VOTE'}</span>
            </button>
            <div className="ctl-joy"><ArcadeConsole /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
