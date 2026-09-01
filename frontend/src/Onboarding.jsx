import { useState } from 'react';

const USERNAME_MAX = 14;
const DESC_MAX = 140;

function StepPills({ step }) {
  return (
    <div className="step-pills">
      {['WALLET', 'CALLSIGN', 'PITCH'].map((l, i) => (
        <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className={`step-pill ${i <= step ? 'on' : ''}`}>
            {i + 1}&nbsp;·&nbsp;{l}
          </span>
          {i < 2 && <span className="step-arrow">→</span>}
        </span>
      ))}
    </div>
  );
}

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [wallet, setWallet] = useState(null);
  const [walletError, setWalletError] = useState('');
  const [connecting, setConnecting] = useState(false);

  const [username, setUsername] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);

  const connectMetaMask = async () => {
    if (!window.ethereum) {
      setWalletError('MetaMask not detected. Install the MetaMask extension and refresh.');
      return;
    }
    setConnecting(true);
    setWalletError('');
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const account = accounts[0];
      setWallet(account);
      setStep(1);
    } catch (err) {
      if (err && err.code === -32002) {
        setWalletError('A connection request is already pending. Please open your MetaMask extension (click the fox icon in your browser toolbar) to approve the request.');
      } else {
        setWalletError(err?.message || 'Connection rejected.');
      }
    } finally {
      setConnecting(false);
    }
  };

  const reconnectMetaMask = async () => {
    if (!window.ethereum) {
      setWalletError('MetaMask not detected. Install the MetaMask extension and refresh.');
      return;
    }
    setConnecting(true);
    setWalletError('');
    try {
      // Force account selection/permission popup
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const account = accounts[0];
      setWallet(account);
      setStep(1);
    } catch (err) {
      if (err && err.code === -32002) {
        setWalletError('A connection request is already pending. Please open your MetaMask extension (click the fox icon in your browser toolbar) to approve the request.');
      } else {
        setWalletError(err?.message || 'Connection rejected.');
      }
    } finally {
      setConnecting(false);
    }
  };

  const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

  const finish = async () => {
    setBusy(true);
    try {
      const res = await fetch('http://localhost:3001/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: wallet || '0xDEMO000000000000000000000000000000000001', description: desc }),
      });
      if (res.ok) {
        const data = await res.json();
        onDone({
          username: username || data.username,
          desc: desc || data.description,
          address: wallet || data.address,
        });
        return;
      }
    } catch {
      // fallback if backend is offline
    }
    onDone({
      username: username || 'YOU',
      desc: desc || 'Your proudest build.',
      address: wallet || '0xDEMO',
    });
  };

  const stepContent = () => {
    if (step === 0) {
      // STEP 1 — connect wallet
      return (
        <div key="s0" className="flyout in">
          <span className="card-title">Connect your wallet</span>
          <p className="card-sub" style={{ margin: '0.7rem 0 1.4rem' }}>
            Your Monad address is your player ID. Funds stay in your pocket — this is a free-to-play coordination arena.
          </p>
          <button className="btn-wallet" onClick={connectMetaMask} disabled={connecting}>
            {connecting ? (
              <>Connecting…</>
            ) : (
              <>
                <span className="fox" /> Connect MetaMask
              </>
            )}
          </button>
          <button className="btn-ghost" style={{ width: '100%', marginTop: '0.7rem' }} onClick={() => setStep(1)}>
            Just a demo — skip wallet
          </button>
          {walletError && <div className="error-box">{walletError}</div>}
        </div>
      );
    }

    if (step === 1) {
      // STEP 2 — username with character limit
      const warn = username.length >= USERNAME_MAX;
      return (
        <div key="s1" className="flyout in">
          <span className="card-title">Pick your callsign</span>
          <p className="card-sub" style={{ margin: '0.7rem 0 1rem' }}>
            8-bit handle, max {USERNAME_MAX} characters. Choose wisely — it's your public legend.
          </p>
          <div className="wallet-row connected">
            <span style={{ fontSize: '1.3rem' }}>🦊</span>
            <span className="wallet-addr">{shortAddr(wallet) || 'DEMO WALLET'}</span>
            <button className="reconnect" onClick={reconnectMetaMask} disabled={connecting}>
              {connecting ? 'connecting…' : 'reconnect'}
            </button>
          </div>
          <div className="field">
            <label htmlFor="uname">Callsign</label>
            <input
              id="uname"
              className="input"
              maxLength={USERNAME_MAX}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. NEO_RUNNER"
              spellCheck={false}
            />
            <div className={`char-count ${warn ? 'warn' : ''}`}>
              {username.length} / {USERNAME_MAX}
            </div>
          </div>
          <button
            className="btn-primary"
            style={{ width: '100%' }}
            disabled={!username.trim()}
            onClick={() => setStep(2)}
          >
            Next →
          </button>
        </div>
      );
    }

    // STEP 3 — pitch / proudest build
    const warn = desc.length >= DESC_MAX;
    return (
      <div key="s2" className="flyout in">
        <span className="card-title">Pitch your build</span>
        <p className="card-sub" style={{ margin: '0.7rem 0 1rem' }}>
          One short sentence on your proudest ship. Max {DESC_MAX} chars. The room will read this before voting.
        </p>
        <div className="field">
          <label htmlFor="udesc">The pitch</label>
          <textarea
            id="udesc"
            className="input textarea"
            maxLength={DESC_MAX}
            rows={3}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="e.g. Built a sub-50ms DEX on Monad that handled 100k tx/s live."
            spellCheck={false}
          />
          <div className={`char-count ${warn ? 'warn' : ''}`}>
            {desc.length} / {DESC_MAX}
          </div>
        </div>
        <button
          className="btn-primary"
          style={{ width: '100%' }}
          disabled={!desc.trim() || busy}
          onClick={finish}
        >
          {busy ? 'Entering arena…' : 'Enter Arena →'}
        </button>
      </div>
    );
  };

  return (
    <div className="onboard">
      <div className="card onboard-inner screen-enter">
        <StepPills step={step} />
        {stepContent()}
      </div>
    </div>
  );
}
