const V0 = 1000;

function loyaltyPercent(switchCount) {
  if (switchCount <= 0) return 100;
  if (switchCount === 1) return 85;
  if (switchCount === 2) return 60;
  if (switchCount === 3) return 40;
  return 15;
}

function activeEquity(switchCount) {
  return Math.floor((V0 * loyaltyPercent(switchCount)) / 100);
}

function effectiveEquity(switchCount, lastSwitchElapsed, duration = 100) {
  const elapsed = Math.max(0, Math.min(duration, lastSwitchElapsed));
  const timePermille = 1000 - Math.floor((200 * elapsed) / duration);
  return Math.floor((activeEquity(switchCount) * timePermille) / 1000);
}

function pairwiseAssignments(count) {
  if (!Number.isInteger(count) || count < 2) throw new Error('At least two players are required');
  const targets = Array(count);
  if (count % 2 === 0) {
    for (let i = 0; i < count; i += 2) {
      targets[i] = i + 1;
      targets[i + 1] = i;
    }
  } else {
    for (let i = 0; i < count - 3; i += 2) {
      targets[i] = i + 1;
      targets[i + 1] = i;
    }
    targets[count - 3] = count - 2;
    targets[count - 2] = count - 1;
    targets[count - 1] = count - 3;
  }
  return targets;
}

function buildLeaderboard(players, duration = 100) {
  const profiles = players.map((player, index) => ({
    profileIndex: index,
    address: player.address,
    username: player.username,
    description: player.description,
    headCount: 0,
    totalActiveEquity: 0,
    totalEffectiveEquity: 0,
  }));

  for (const player of players) {
    const profile = profiles[player.targetProfile];
    if (!profile) continue;
    profile.headCount += 1;
    profile.totalActiveEquity += activeEquity(player.switchCount);
    profile.totalEffectiveEquity += effectiveEquity(
      player.switchCount,
      player.lastSwitchElapsed,
      duration,
    );
  }

  return profiles.sort(
    (a, b) =>
      b.headCount - a.headCount ||
      b.totalActiveEquity - a.totalActiveEquity ||
      a.profileIndex - b.profileIndex,
  );
}

function computeSettlement(players, pool, duration = 100) {
  const leaderboard = buildLeaderboard(players, duration);
  const winner = leaderboard[0];
  const backers = players
    .filter((player) => player.targetProfile === winner.profileIndex)
    .sort((a, b) => a.address.localeCompare(b.address));
  const weights = backers.map((player) =>
    effectiveEquity(player.switchCount, player.lastSwitchElapsed, duration),
  );
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const payouts = backers.map((player, index) => ({
    address: player.address,
    amount: totalWeight === 0 ? 0 : Math.floor((pool * weights[index]) / totalWeight),
    effectiveEquity: weights[index],
  }));
  const distributed = payouts.reduce((sum, payout) => sum + payout.amount, 0);
  if (payouts.length > 0) payouts[0].amount += pool - distributed;

  return {
    winningProfile: winner.profileIndex,
    winner,
    leaderboard,
    totalWinningEquity: totalWeight,
    payouts,
  };
}

module.exports = {
  V0,
  loyaltyPercent,
  activeEquity,
  effectiveEquity,
  pairwiseAssignments,
  buildLeaderboard,
  computeSettlement,
};
