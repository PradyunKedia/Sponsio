import { useState } from 'react';
import { formatEther } from 'viem';
import { claimOnChain, explorerTx, refundOnChain } from './lib/chain';

export default function FinalScreen({ me, room, chainConfig, onPlayAgain, onHome }) {
  const [claiming, setClaiming] = useState(false);
  const [claimHash, setClaimHash] = useState('');
  const [error, setError] = useState('');
  const settlement = room?.settlement;
  const payout = settlement?.payouts?.find((item) => item.address === me?.wallet);
  const winner = room?.leaderboard?.find(
    (profile) => profile.profileIndex === settlement?.winningProfile,
  );
  const won = Boolean(payout && BigInt(payout.amount || 0) > 0n);

  const claim = async () => {
    setClaiming(true);
    setError('');
    try {
      const receipt = await claimOnChain({
        account: me.wallet,
        contractAddress: chainConfig.contractAddress,
        roomId: room.contractRoomId,
        amount: payout.amount,
        proof: payout.proof,
      });
      setClaimHash(receipt.transactionHash);
    } catch (reason) {
      setError(reason.message || 'Claim failed.');
    } finally {
      setClaiming(false);
    }
  };

  const refund = async () => {
    setClaiming(true);
    setError('');
    try {
      const receipt = await refundOnChain({
        account: me.wallet,
        contractAddress: chainConfig.contractAddress,
        roomId: room.contractRoomId,
      });
      setClaimHash(receipt.transactionHash);
    } catch (reason) {
      setError(reason.message || 'Refund is not available yet.');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="final">
      <div className="final-inner screen-enter">
        <div className="result-ring">
          <div className="result-circle">
            <div className="sum">{won ? 'WIN' : 'GG'}</div>
            <div className="lab">MONAD TESTNET</div>
          </div>
        </div>

        <div className="final-title">WINNER — {winner?.username || 'SETTLING'}</div>
        <div className="final-earned">
          {won ? `+ ${Number(formatEther(BigInt(payout.amount))).toFixed(6)}` : '+ 0'} <b>MON</b>
        </div>
        <p className="final-sub">
          {won
            ? 'Your payout is committed by Merkle root on Monad Testnet. Claim it directly from the escrow contract.'
            : 'You did not back the winning profile this round. The complete result remains publicly auditable.'}
        </p>

        {settlement?.chainStatus === 'publishing' && (
          <div className="info-box">Publishing settlement to Monad Testnet…</div>
        )}
        {error && <div className="error-box">{error}</div>}
        {claimHash && (
          <a className="btn-ghost" href={explorerTx(claimHash)} target="_blank" rel="noreferrer">
            VIEW CLAIM ON MONADSCAN
          </a>
        )}

        <div className="final-actions">
          {won && !claimHash && (
            <button
              className="btn-gold"
              style={{ width: '100%' }}
              disabled={claiming || settlement?.chainStatus !== 'finalized'}
              onClick={claim}
            >
              {claiming ? 'CLAIMING…' : 'CLAIM TESTNET MON'}
            </button>
          )}
          {settlement?.chainStatus === 'failed' && !claimHash && (
            <button className="btn-gold" style={{ width: '100%' }} disabled={claiming} onClick={refund}>
              {claiming ? 'CHECKING REFUND…' : 'REFUND AFTER TIMEOUT'}
            </button>
          )}
          <button className="btn-primary" style={{ width: '100%' }} onClick={onPlayAgain}>
            JOIN ANOTHER ROOM
          </button>
          <button className="btn-ghost" style={{ width: '100%' }} onClick={onHome}>
            BACK TO HOME
          </button>
        </div>
      </div>
    </div>
  );
}
