const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { Room, PHASES } = require('./room');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeCode() {
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes, (value) => CODE_ALPHABET[value % CODE_ALPHABET.length]).join('');
}

class RoomManager extends EventEmitter {
  constructor(store, config) {
    super();
    this.store = store;
    this.config = config;
    this.rooms = new Map();
    this.queues = new Map();
    for (const snapshot of store.loadRooms()) {
      const room = Room.restore(snapshot);
      room.advance();
      this.rooms.set(room.code, room);
    }
    this.tickTimer = setInterval(() => this.tick(), 1000);
    this.tickTimer.unref?.();
  }

  create({ label, capacity, hostAddress = null } = {}) {
    let code;
    do code = makeCode();
    while (this.rooms.has(code));
    const room = new Room({
      id: crypto.randomUUID(),
      code,
      label,
      capacity: capacity || this.config.ROOM_CAPACITY,
      durationSec: this.config.GAME_DURATION_SEC,
      countdownSec: this.config.COUNTDOWN_SEC,
      hostAddress,
    });
    this.rooms.set(code, room);
    this.persist(room, 'room_created', { code });
    return room;
  }

  get(code) {
    return this.rooms.get(String(code || '').toUpperCase()) || null;
  }

  list() {
    return Array.from(this.rooms.values())
      .filter((room) => room.status !== PHASES.SETTLED)
      .map((room) => room.snapshot(Date.now(), false));
  }

  async mutate(code, operation) {
    const room = this.get(code);
    if (!room) throw new Error('Room not found');
    const prior = this.queues.get(room.code) || Promise.resolve();
    const next = prior.then(() => operation(room));
    this.queues.set(room.code, next.catch(() => {}));
    const result = await next;
    return result;
  }

  persist(room, type, payload) {
    this.store.appendEvent(room.id, room.seq, type, payload);
    this.store.saveRoom(room.serialize());
    this.emit('event', { room, type, payload, seq: room.seq });
  }

  tick(now = Date.now()) {
    for (const room of this.rooms.values()) {
      const transition = room.advance(now);
      if (transition) this.persist(room, transition, room.snapshot(now, false));
      if (room.status === PHASES.COUNTDOWN || room.status === PHASES.LIVE) {
        this.emit('tick', { room, snapshot: room.snapshot(now, false) });
      }
    }
    this.store.cleanup(now);
  }

  close() {
    clearInterval(this.tickTimer);
  }
}

module.exports = { RoomManager };
