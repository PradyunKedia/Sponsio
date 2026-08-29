const test = require('node:test');
const assert = require('node:assert/strict');
const {
  loyaltyPercent,
  effectiveEquity,
  pairwiseAssignments,
  computeSettlement,
} = require('../src/game/engine');

test('loyalty and time decay match Sponsio economics', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(loyaltyPercent), [100, 85, 60, 40, 15]);
  assert.equal(effectiveEquity(0, 0), 1000);
  assert.equal(effectiveEquity(1, 10), 833);
  assert.equal(effectiveEquity(4, 100), 120);
});

test('pairwise assignments support every room size from 2 to 100', () => {
  for (let count = 2; count <= 100; count += 1) {
    const targets = pairwiseAssignments(count);
    assert.equal(targets.length, count);
    targets.forEach((target, index) => {
      assert.ok(target >= 0 && target < count);
      assert.notEqual(target, index);
    });
    assert.equal(new Set(targets).size, count);
  }
});

test('settlement conserves the full pool with deterministic tie-breaking', () => {
  const players = [
    { address: '0x0000000000000000000000000000000000000001', targetProfile: 1, switchCount: 0, lastSwitchElapsed: 0, username: 'A' },
    { address: '0x0000000000000000000000000000000000000002', targetProfile: 1, switchCount: 1, lastSwitchElapsed: 10, username: 'B' },
    { address: '0x0000000000000000000000000000000000000003', targetProfile: 2, switchCount: 0, lastSwitchElapsed: 0, username: 'C' },
  ];
  const settlement = computeSettlement(players, 3000);
  assert.equal(settlement.winningProfile, 1);
  assert.equal(settlement.payouts.reduce((sum, payout) => sum + payout.amount, 0), 3000);
});
