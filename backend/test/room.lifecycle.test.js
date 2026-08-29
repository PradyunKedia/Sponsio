const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SponsioStore } = require('../src/store/database');
const { RoomManager } = require('../src/game/roomManager');

function player(index) {
  return {
    address: `0x${index.toString(16).padStart(40, '0')}`,
    username: `PLAYER_${index}`,
    description: `A valid project description for player ${index}`,
  };
}

function setup() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sponsio-'));
  const store = new SponsioStore(dataDir);
  const config = {
    ROOM_CAPACITY: 100,
    GAME_DURATION_SEC: 100,
    COUNTDOWN_SEC: 0,
  };
  const manager = new RoomManager(store, config);
  return { dataDir, store, manager, config };
}

test('room lifecycle handles real joins, idempotent switches, and settlement', async () => {
  const { dataDir, store, manager } = setup();
  const room = manager.create();
  room.join(player(1));
  room.join(player(2));
  room.join(player(3));
  room.beginCountdown(1_000);
  room.advance(1_000);
  assert.equal(room.status, 'live');

  const first = room.switchProfile(player(1).address, 2, 1, 2_000);
  const duplicate = room.switchProfile(player(1).address, 2, 1, 2_001);
  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  room.advance(102_000);
  assert.equal(room.status, 'settled');
  assert.equal(room.settlement.payouts.reduce((sum, item) => sum + item.amount, 0), 3000);

  manager.persist(room, 'test_complete', {});
  manager.close();
  store.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('active room snapshots survive a process restart', () => {
  const { dataDir, store, manager, config } = setup();
  const room = manager.create({ capacity: 50 });
  room.join(player(1));
  manager.persist(room, 'player_joined', {});
  manager.close();
  store.close();

  const reopenedStore = new SponsioStore(dataDir);
  const reopened = new RoomManager(reopenedStore, config);
  assert.equal(reopened.get(room.code).players.length, 1);
  assert.equal(reopened.get(room.code).capacity, 50);
  reopened.close();
  reopenedStore.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});
