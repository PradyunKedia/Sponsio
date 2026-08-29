const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const { createRoomSchema, nonceSchema, joinSchema } = require('./lib/schemas');
const { normalizeAddress } = require('./auth/wallet');
const { attachRoomSockets } = require('./ws/handler');
const { buildPayoutTree, roomIdToBytes32 } = require('./chain/settlement');
const { keccak256, toHex } = require('viem');

function createRateLimiter({ windowMs = 60_000, limit = 120 } = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const bucket = (buckets.get(key) || []).filter((time) => now - time < windowMs);
    if (bucket.length >= limit) return res.status(429).json({ error: 'Too many requests' });
    bucket.push(now);
    buckets.set(key, bucket);
    next();
  };
}

function bearerToken(req) {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function createServer({ config, roomManager, auth, chain = null }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  const corsOrigins = config.CORS_ORIGIN.split(',').map((value) => value.trim());
  if (config.NODE_ENV === 'development') {
    corsOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173');
  }
  app.use(cors({ origin: [...new Set(corsOrigins)] }));
  app.use(express.json({ limit: '32kb' }));
  // Event Wi-Fi often puts every phone behind one public IP.
  app.use(createRateLimiter({ limit: 1000 }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, network: 'monad-testnet', rooms: roomManager.rooms.size });
  });

  app.get('/config', (_req, res) => {
    res.json({
      chainId: 10143,
      network: 'Monad Testnet',
      contractAddress: config.SPONSIO_TESTNET_ADDRESS || null,
      stakeWei: config.ROOM_STAKE_WEI,
      explorerUrl: 'https://testnet.monadscan.com',
      chainEnabled: Boolean(chain),
    });
  });

  app.post('/rooms', async (req, res, next) => {
    try {
      const input = createRoomSchema.parse(req.body || {});
      const room = roomManager.create(input);
      room.contractRoomId = roomIdToBytes32(room.id);
      if (chain) {
        await chain.createRoom({
          roomId: room.contractRoomId,
          stake: config.ROOM_STAKE_WEI,
          capacity: room.capacity,
          joinDeadline: Math.floor(Date.now() / 1000) + 30 * 60,
        });
      }
      roomManager.persist(room, 'contract_room_created', {
        contractRoomId: room.contractRoomId,
        onChain: Boolean(chain),
      });
      res.status(201).json({ room: room.snapshot(Date.now(), true) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/rooms', (_req, res) => {
    res.json({ rooms: roomManager.list() });
  });

  app.get('/rooms/:code', (req, res) => {
    const room = roomManager.get(req.params.code);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({ room: room.snapshot(Date.now(), true) });
  });

  app.post('/auth/nonce', (req, res, next) => {
    try {
      const input = nonceSchema.parse(req.body);
      const room = roomManager.get(input.roomCode);
      if (!room) return res.status(404).json({ error: 'Room not found' });
      res.json(auth.issueNonce(room.id, input.address));
    } catch (error) {
      next(error);
    }
  });

  app.post('/rooms/:code/join', async (req, res, next) => {
    try {
      const input = joinSchema.parse(req.body);
      const room = roomManager.get(req.params.code);
      if (!room) return res.status(404).json({ error: 'Room not found' });
      const session = await auth.verifyAndCreateSession({
        roomId: room.id,
        address: input.address,
        nonce: input.nonce,
        signature: input.signature,
      });
      if (chain) {
        const joinedOnChain = await chain.hasJoined(room.contractRoomId, session.address);
        if (!joinedOnChain) {
          return res.status(409).json({ error: 'Monad Testnet join transaction is not finalized' });
        }
      }
      const player = await roomManager.mutate(room.code, (activeRoom) => {
        const joined = activeRoom.join({
          address: session.address,
          username: input.username,
          description: input.description,
          joinTxHash: input.joinTxHash,
        });
        roomManager.persist(activeRoom, 'player_joined', {
          address: joined.address,
          profileIndex: joined.profileIndex,
          username: joined.username,
        });
        return joined;
      });
      res.status(201).json({
        token: session.token,
        expiresAt: session.expiresAt,
        player,
        room: room.snapshot(Date.now(), true),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/rooms/:code/start', async (req, res, next) => {
    try {
      const room = roomManager.get(req.params.code);
      if (!room) return res.status(404).json({ error: 'Room not found' });
      const session = auth.authenticate(bearerToken(req));
      if (!session || session.roomId !== room.id) return res.status(401).json({ error: 'Unauthorized' });
      if (normalizeAddress(session.address) !== room.hostAddress) {
        return res.status(403).json({ error: 'Only the room host can start the game' });
      }
      await roomManager.mutate(room.code, async (activeRoom) => {
        const now = Date.now();
        const gameEnd = Math.floor((now + activeRoom.countdownSec * 1000 + activeRoom.durationSec * 1000) / 1000);
        if (chain) {
          await chain.startRoom({
            roomId: activeRoom.contractRoomId,
            gameEnd,
            settleDeadline: gameEnd + 5 * 60,
            claimDeadline: gameEnd + 65 * 60,
          });
        }
        activeRoom.beginCountdown(now);
        roomManager.persist(activeRoom, 'game_countdown', {
          startAt: activeRoom.startAt,
          endsAt: activeRoom.endsAt,
        });
      });
      res.json({ room: room.snapshot(Date.now(), true) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/rooms/:code/settlement', (req, res) => {
    const room = roomManager.get(req.params.code);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.settlement) return res.status(409).json({ error: 'Settlement is not ready' });
    res.json({ settlement: room.settlement });
  });

  const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
  if (config.NODE_ENV === 'production' && fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/rooms') || req.path.startsWith('/auth')) {
        return next();
      }
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  app.use((error, _req, res, _next) => {
    const status =
      error.message === 'Room is full' ? 409 :
      error.name === 'ZodError' ? 400 :
      400;
    res.status(status).json({ error: error.message || 'Request failed' });
  });

  const server = http.createServer(app);
  const wss = attachRoomSockets(server, roomManager, auth);

  roomManager.on('event', async ({ room, type }) => {
    if (type !== 'game_ended' || room.settlement?.payoutsRoot) return;
    try {
      const poolWei = BigInt(config.ROOM_STAKE_WEI) * BigInt(room.players.length);
      const tree = buildPayoutTree(
        room.contractRoomId,
        room.settlement.payouts,
        poolWei,
      );
      const stateRoot = keccak256(toHex(JSON.stringify({
        roomId: room.id,
        seq: room.seq,
        winningProfile: room.settlement.winningProfile,
        players: room.players.map((player) => ({
          address: player.address,
          targetProfile: player.targetProfile,
          switchCount: player.switchCount,
          lastSwitchElapsed: player.lastSwitchElapsed,
        })),
      })));
      room.settlement = {
        ...room.settlement,
        stateRoot,
        payoutsRoot: tree.root,
        payouts: tree.payouts,
        totalPayoutWei: tree.totalPayout,
        chainStatus: chain ? 'publishing' : 'not-configured',
      };
      room.seq += 1;
      roomManager.persist(room, 'settlement_prepared', {
        payoutsRoot: tree.root,
        stateRoot,
      });
      if (chain) {
        let receipt;
        let publishError;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          try {
            receipt = await chain.publish({
              roomId: room.contractRoomId,
              winningProfile: room.settlement.winningProfile,
              stateRoot,
              payoutsRoot: tree.root,
              totalPayout: tree.totalPayout,
            });
            break;
          } catch (error) {
            publishError = error;
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
        if (!receipt) throw publishError;
        room.settlement.chainStatus = 'finalized';
        room.settlement.settlementTxHash = receipt.transactionHash;
        room.seq += 1;
        roomManager.persist(room, 'settlement_finalized', {
          transactionHash: receipt.transactionHash,
        });
      }
    } catch (error) {
      room.settlement.chainStatus = 'failed';
      room.settlement.chainError = error.message;
      room.seq += 1;
      roomManager.persist(room, 'settlement_failed', { message: error.message });
    }
  });
  return { app, server, wss };
}

module.exports = { createServer };
