const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const WebSocket = require('ws');
const { privateKeyToAccount } = require('viem/accounts');
const { SponsioStore } = require('../src/store/database');
const { WalletAuth } = require('../src/auth/wallet');
const { RoomManager } = require('../src/game/roomManager');
const { createServer } = require('../src/server');

async function runLoadTest() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sponsio-load-'));
  const config = {
    PORT: 0,
    CORS_ORIGIN: 'http://localhost:5173',
    SESSION_SECRET: 'load-test-session-secret',
    ROOM_CAPACITY: 100,
    GAME_DURATION_SEC: 100,
    COUNTDOWN_SEC: 0,
    ROOM_STAKE_WEI: '1000',
  };
  const store = new SponsioStore(dataDir);
  const auth = new WalletAuth(store, config.SESSION_SECRET);
  const manager = new RoomManager(store, config);
  const room = manager.create({ capacity: 100 });
  const sessions = [];

  for (let index = 1; index <= 100; index += 1) {
    const account = privateKeyToAccount(`0x${index.toString(16).padStart(64, '0')}`);
    const challenge = auth.issueNonce(room.id, account.address);
    const signature = await account.signMessage({ message: challenge.message });
    const session = await auth.verifyAndCreateSession({
      roomId: room.id,
      address: account.address,
      nonce: challenge.nonce,
      signature,
    });
    room.join({
      address: session.address,
      username: `P${index}`,
      description: `Load-test project number ${index}`,
    });
    sessions.push(session);
  }
  room.beginCountdown(Date.now());
  room.advance(Date.now());

  const { server } = createServer({ config, roomManager: manager, auth });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const sockets = await Promise.all(sessions.map((session) => new Promise((resolve, reject) => {
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/ws?room=${room.code}&token=${encodeURIComponent(session.token)}`,
    );
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  })));

  const startedAt = Date.now();
  sockets.forEach((socket, index) => {
    const current = room.players[index].targetProfile;
    let next = (current + 1) % room.players.length;
    if (next === current) next = (next + 1) % room.players.length;
    socket.send(JSON.stringify({ type: 'switch', profileIndex: next, clientSeq: 1 }));
  });
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const headCount = room.snapshot().leaderboard.reduce((sum, profile) => sum + profile.headCount, 0);
  if (headCount !== 100) throw new Error(`Headcount drifted to ${headCount}`);
  if (room.players.some((player) => player.clientSeq !== 1)) {
    throw new Error('Not every concurrent switch was applied');
  }
  console.log(`100 clients connected and switched in ${Date.now() - startedAt}ms`);

  sockets.forEach((socket) => socket.close());
  await new Promise((resolve) => server.close(resolve));
  manager.close();
  store.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}

runLoadTest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
