const { WebSocketServer } = require('ws');
const { switchSchema } = require('../lib/schemas');
const { send } = require('./protocol');

function attachRoomSockets(server, roomManager, auth) {
  const wss = new WebSocketServer({ noServer: true });
  const socketsByRoom = new Map();

  const broadcast = (roomCode, type, payload) => {
    const sockets = socketsByRoom.get(roomCode);
    if (!sockets) return;
    for (const socket of sockets) send(socket, type, payload);
  };

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname !== '/ws') return socket.destroy();
      const roomCode = (url.searchParams.get('room') || '').toUpperCase();
      const session = auth.authenticate(url.searchParams.get('token'));
      const room = roomManager.get(roomCode);
      if (!room || !session || session.roomId !== room.id) return socket.destroy();
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.roomCode = roomCode;
        ws.address = session.address;
        wss.emit('connection', ws);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (socket) => {
    const room = roomManager.get(socket.roomCode);
    if (!socketsByRoom.has(socket.roomCode)) socketsByRoom.set(socket.roomCode, new Set());
    const roomSockets = socketsByRoom.get(socket.roomCode);
    for (const existing of roomSockets) {
      if (existing.address === socket.address) existing.close(4001, 'Reconnected elsewhere');
    }
    roomSockets.add(socket);
    const player = room.getPlayer(socket.address);
    if (player) player.connected = true;
    socket.rateWindow = [];
    send(socket, 'room_state', { room: room.snapshot(Date.now(), true) });

    socket.on('message', async (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === 'ping') {
          send(socket, 'pong', { serverNow: Date.now(), clientTime: message.clientTime });
          return;
        }
        const action = switchSchema.parse(message);
        const now = Date.now();
        socket.rateWindow = socket.rateWindow.filter((timestamp) => now - timestamp < 1000);
        if (socket.rateWindow.length >= 3) throw new Error('Switch rate limit exceeded');
        socket.rateWindow.push(now);

        const result = await roomManager.mutate(socket.roomCode, (activeRoom) => {
          const applied = activeRoom.switchProfile(
            socket.address,
            action.profileIndex,
            action.clientSeq,
            now,
          );
          if (!applied.duplicate) {
            roomManager.persist(activeRoom, 'switch_applied', {
              address: socket.address,
              fromProfile: applied.fromProfile,
              profileIndex: action.profileIndex,
              switchCount: applied.player.switchCount,
              elapsed: applied.elapsed,
              clientSeq: action.clientSeq,
            });
          }
          return applied;
        });
        send(socket, 'switch_ack', {
          clientSeq: action.clientSeq,
          duplicate: result.duplicate,
        });
      } catch (error) {
        send(socket, 'error', { code: 'INVALID_ACTION', message: error.message, recoverable: true });
      }
    });

    socket.on('close', () => {
      roomSockets.delete(socket);
      const currentRoom = roomManager.get(socket.roomCode);
      const currentPlayer = currentRoom?.getPlayer(socket.address);
      if (currentPlayer) currentPlayer.connected = false;
      if (roomSockets.size === 0) socketsByRoom.delete(socket.roomCode);
    });
  });

  roomManager.on('event', ({ room, type, payload, seq }) => {
    broadcast(room.code, type, { payload, seq });
    broadcast(room.code, 'room_state', { room: room.snapshot(Date.now(), true) });
  });
  roomManager.on('tick', ({ room, snapshot }) => {
    broadcast(room.code, 'tick', { room: snapshot });
  });

  return wss;
}

module.exports = { attachRoomSockets };
