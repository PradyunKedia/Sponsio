const {
  V0,
  activeEquity,
  effectiveEquity,
  pairwiseAssignments,
  buildLeaderboard,
  computeSettlement,
} = require('./engine');

const PHASES = Object.freeze({
  LOBBY: 'lobby',
  COUNTDOWN: 'countdown',
  LIVE: 'live',
  FROZEN: 'frozen',
  SETTLED: 'settled',
});

class Room {
  constructor(input) {
    this.id = input.id;
    this.code = input.code;
    this.label = input.label || 'Sponsio Arena';
    this.capacity = Math.min(100, Math.max(2, input.capacity || 100));
    this.durationSec = input.durationSec || 100;
    this.countdownSec = input.countdownSec ?? 3;
    this.hostAddress = input.hostAddress || null;
    this.status = input.status || PHASES.LOBBY;
    this.createdAt = input.createdAt || Date.now();
    this.startAt = input.startAt || null;
    this.endsAt = input.endsAt || null;
    this.seq = input.seq || 0;
    this.players = (input.players || []).map((player) => ({ ...player }));
    this.settlement = input.settlement || null;
    this.contractRoomId = input.contractRoomId || null;
  }

  static restore(snapshot) {
    return new Room(snapshot);
  }

  getPlayer(address) {
    return this.players.find((player) => player.address === address);
  }

  join({ address, username, description, joinTxHash = null }) {
    if (this.status !== PHASES.LOBBY) throw new Error('Room is no longer accepting players');
    const existing = this.getPlayer(address);
    if (existing) return existing;
    if (this.players.length >= this.capacity) throw new Error('Room is full');
    const player = {
      address,
      username,
      description,
      profileIndex: this.players.length,
      targetProfile: null,
      switchCount: 0,
      lastSwitchElapsed: 0,
      clientSeq: 0,
      joinedAt: Date.now(),
      joinTxHash,
      connected: false,
    };
    if (!this.hostAddress) this.hostAddress = address;
    this.players.push(player);
    this.seq += 1;
    return player;
  }

  beginCountdown(now = Date.now()) {
    if (this.status !== PHASES.LOBBY) throw new Error('Room cannot be started now');
    if (this.players.length < 2) throw new Error('At least two players are required');
    this.status = PHASES.COUNTDOWN;
    this.startAt = now + this.countdownSec * 1000;
    this.endsAt = this.startAt + this.durationSec * 1000;
    const assignments = pairwiseAssignments(this.players.length);
    this.players.forEach((player, index) => {
      player.targetProfile = assignments[index];
      player.switchCount = 0;
      player.lastSwitchElapsed = 0;
    });
    this.seq += 1;
  }

  advance(now = Date.now()) {
    if (this.status === PHASES.COUNTDOWN && now >= this.startAt) {
      this.status = PHASES.LIVE;
      this.seq += 1;
      return 'game_started';
    }
    if (this.status === PHASES.LIVE && now >= this.endsAt) {
      this.status = PHASES.FROZEN;
      this.settlement = computeSettlement(this.players, this.players.length * V0, this.durationSec);
      this.status = PHASES.SETTLED;
      this.seq += 1;
      return 'game_ended';
    }
    return null;
  }

  switchProfile(address, newProfile, clientSeq, now = Date.now()) {
    this.advance(now);
    if (this.status !== PHASES.LIVE) throw new Error('Game is not live');
    if (now >= this.endsAt) throw new Error('Game window ended');
    if (!Number.isInteger(newProfile) || newProfile < 0 || newProfile >= this.players.length) {
      throw new Error('Invalid profile');
    }
    const player = this.getPlayer(address);
    if (!player) throw new Error('Player is not in this room');
    if (!Number.isInteger(clientSeq) || clientSeq <= 0) throw new Error('Invalid client sequence');
    if (clientSeq <= player.clientSeq) {
      return { duplicate: true, player };
    }
    if (player.targetProfile === newProfile) throw new Error('Already backing this profile');

    const fromProfile = player.targetProfile;
    const elapsed = Math.max(0, Math.min(this.durationSec, Math.floor((now - this.startAt) / 1000)));
    player.targetProfile = newProfile;
    player.switchCount += 1;
    player.lastSwitchElapsed = elapsed;
    player.clientSeq = clientSeq;
    this.seq += 1;
    return { duplicate: false, player, fromProfile, elapsed };
  }

  snapshot(now = Date.now(), includePlayers = true) {
    this.advance(now);
    const remainingMs =
      this.endsAt == null ? null : Math.max(0, this.endsAt - now);
    const leaderboard =
      this.players.length >= 2 && this.players.every((player) => player.targetProfile != null)
        ? buildLeaderboard(this.players, this.durationSec)
        : this.players.map((player) => ({
            profileIndex: player.profileIndex,
            address: player.address,
            username: player.username,
            description: player.description,
            headCount: 0,
            totalActiveEquity: 0,
            totalEffectiveEquity: 0,
          }));
    return {
      id: this.id,
      code: this.code,
      label: this.label,
      capacity: this.capacity,
      durationSec: this.durationSec,
      countdownSec: this.countdownSec,
      hostAddress: this.hostAddress,
      status: this.status,
      createdAt: this.createdAt,
      startAt: this.startAt,
      endsAt: this.endsAt,
      serverNow: now,
      remainingMs,
      seq: this.seq,
      playerCount: this.players.length,
      players: includePlayers
        ? this.players.map((player) => ({
            ...player,
            activeEquity: activeEquity(player.switchCount),
            effectiveEquity: effectiveEquity(
              player.switchCount,
              player.lastSwitchElapsed,
              this.durationSec,
            ),
          }))
        : undefined,
      leaderboard,
      settlement: this.settlement,
      contractRoomId: this.contractRoomId,
    };
  }

  serialize() {
    return {
      ...this.snapshot(Date.now(), true),
      players: this.players,
    };
  }
}

module.exports = { Room, PHASES };
