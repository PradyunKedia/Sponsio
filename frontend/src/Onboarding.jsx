import { useState } from 'react';
import { api } from './lib/api';
import {
  connectMetaMask,
  joinOnChain,
  signRoomMessage,
} from './lib/chain';

const USERNAME_MAX = 14;
const DESC_MAX = 160;

function StepPills({ step }) {
  return (
    <div className="step-pills">
      {['METAMASK', 'PROFILE', 'TESTNET'].map((label, index) => (
        <span key={label} className={`step-pill ${index <= step ? 'on' : ''}`}>
          {index + 1}&nbsp;·&nbsp;{label}
        </span>
      ))}
    </div>
  );
}

export default function Onboarding({ roomCode, chainConfig, onDone }) {
  const [step, setStep] = useState(0);
  const [wallet, setWallet] = useState('');
  const [username, setUsername] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const connect = async () => {
    setBusy(true);
    setError('');
    try {
      const account = await connectMetaMask();
      setWallet(account.toLowerCase());
      setStep(1);
    } catch (reason) {
      setError(reason.message || 'MetaMask connection failed.');
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    setBusy(true);
    setError('');
    try {
      const activeChainConfig = chainConfig?.contractAddress
        ? chainConfig
        : await api.config();
      if (!activeChainConfig?.contractAddress) {
        throw new Error('Sponsio has not been configured with a Monad Testnet contract.');
      }
      setStatus('Preparing wallet authentication…');
      const { room } = await api.getRoom(roomCode);
      const challenge = await api.nonce(roomCode, wallet);
      const signature = await signRoomMessage(challenge.message, wallet);

      setStatus('Confirm the room stake in MetaMask…');
      const receipt = await joinOnChain({
        account: wallet,
        contractAddress: activeChainConfig.contractAddress,
        roomId: room.contractRoomId,
        stakeWei: activeChainConfig.stakeWei,
      });

      setStatus('Waiting for the arena to verify your entry…');
      const joined = await api.joinRoom(roomCode, {
        address: wallet,
        username: username.trim(),
        description: description.trim(),
        nonce: challenge.nonce,
        signature,
        joinTxHash: receipt.transactionHash,
      });
      onDone({
        player: { ...joined.player, wallet: joined.player.address },
        token: joined.token,
      });
    } catch (reason) {
      setError(reason.message || 'Unable to join the room.');
    } finally {
      setBusy(false);
      setStatus('');
    }
  };

  return (
    <div className="onboard">
      <div className="card onboard-inner screen-enter">
        <StepPills step={step} />

        {step === 0 && (
          <div className="flyout in">
            <span className="card-title">Connect MetaMask</span>
            <p className="card-sub" style={{ margin: '0.7rem 0 1.4rem' }}>
              Sponsio runs on Monad Testnet. MetaMask will switch networks before any signature or transaction.
            </p>
            <button className="btn-wallet" onClick={connect} disabled={busy}>
              <span className="fox" /> {busy ? 'CONNECTING…' : 'CONNECT METAMASK'}
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="flyout in">
            <span className="card-title">Create your profile</span>
            <div className="wallet-row connected" style={{ marginTop: '1rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🦊</span>
              <span className="wallet-addr">{wallet.slice(0, 6)}…{wallet.slice(-4)}</span>
              <span className="wallet-tag">MONAD TESTNET</span>
            </div>
            <div className="field">
              <label htmlFor="uname">Callsign</label>
              <input
                id="uname"
                className="input"
                maxLength={USERNAME_MAX}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="NEO_RUNNER"
              />
              <div className="char-count">{username.length} / {USERNAME_MAX}</div>
            </div>
            <div className="field">
              <label htmlFor="description">Proudest build</label>
              <textarea
                id="description"
                className="input"
                maxLength={DESC_MAX}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the project you want the room to back…"
                rows="4"
              />
              <div className="char-count">{description.length} / {DESC_MAX}</div>
            </div>
            <button
              className="btn-primary"
              style={{ width: '100%' }}
              disabled={!username.trim() || description.trim().length < 10}
              onClick={() => setStep(2)}
            >
              REVIEW ENTRY →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flyout in">
            <span className="card-title">Enter room {roomCode}</span>
            <p className="card-sub" style={{ margin: '0.7rem 0 1.2rem' }}>
              MetaMask will submit a {chainConfig?.stakeWei
                ? `${Number(chainConfig.stakeWei) / 1e18} testnet MON`
                : 'testnet MON'} room stake. The contract escrows it until settlement or refund.
            </p>
            <div className="info-box">Network: Monad Testnet · Up to 100 players</div>
            <button
              className="btn-primary"
              style={{ width: '100%', marginTop: '1rem' }}
              disabled={busy}
              onClick={join}
            >
              {busy ? status || 'CONFIRMING…' : 'SIGN & JOIN ON TESTNET'}
            </button>
            <button className="btn-ghost" style={{ width: '100%', marginTop: '0.7rem' }} onClick={() => setStep(1)}>
              ← EDIT PROFILE
            </button>
          </div>
        )}

        {error && <div className="error-box">{error}</div>}
      </div>
    </div>
  );
}
