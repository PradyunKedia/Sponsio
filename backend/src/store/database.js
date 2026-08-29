const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

class SponsioStore {
  constructor(dataDir, filename = 'sponsio.sqlite') {
    fs.mkdirSync(dataDir, { recursive: true });
    this.db = new Database(path.join(dataDir, filename));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        snapshot TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(room_id, seq)
      );
      CREATE TABLE IF NOT EXISTS nonces (
        room_id TEXT NOT NULL,
        address TEXT NOT NULL,
        nonce TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY(room_id, address)
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        address TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);
    this.saveRoomStmt = this.db.prepare(`
      INSERT INTO rooms(id, snapshot, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET snapshot=excluded.snapshot, updated_at=excluded.updated_at
    `);
    this.appendEventStmt = this.db.prepare(`
      INSERT OR IGNORE INTO events(room_id, seq, type, payload, created_at) VALUES (?, ?, ?, ?, ?)
    `);
  }

  saveRoom(snapshot) {
    this.saveRoomStmt.run(snapshot.id, JSON.stringify(snapshot), Date.now());
  }

  appendEvent(roomId, seq, type, payload) {
    this.appendEventStmt.run(roomId, seq, type, JSON.stringify(payload), Date.now());
  }

  loadRooms() {
    return this.db.prepare('SELECT snapshot FROM rooms').all().map((row) => JSON.parse(row.snapshot));
  }

  saveNonce(roomId, address, nonce, expiresAt) {
    this.db.prepare(`
      INSERT INTO nonces(room_id, address, nonce, expires_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(room_id, address) DO UPDATE SET nonce=excluded.nonce, expires_at=excluded.expires_at
    `).run(roomId, address, nonce, expiresAt);
  }

  consumeNonce(roomId, address, nonce) {
    return this.db.transaction(() => {
      const row = this.db.prepare(
        'SELECT nonce, expires_at FROM nonces WHERE room_id = ? AND address = ?',
      ).get(roomId, address);
      if (!row || row.nonce !== nonce || row.expires_at < Date.now()) return false;
      this.db.prepare('DELETE FROM nonces WHERE room_id = ? AND address = ?').run(roomId, address);
      return true;
    })();
  }

  saveSession(tokenHash, roomId, address, expiresAt) {
    this.db.prepare(
      'INSERT OR REPLACE INTO sessions(token_hash, room_id, address, expires_at) VALUES (?, ?, ?, ?)',
    ).run(tokenHash, roomId, address, expiresAt);
  }

  getSession(tokenHash) {
    return this.db.prepare(
      'SELECT room_id AS roomId, address, expires_at AS expiresAt FROM sessions WHERE token_hash = ?',
    ).get(tokenHash);
  }

  cleanup(now = Date.now()) {
    this.db.prepare('DELETE FROM nonces WHERE expires_at < ?').run(now);
    this.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  }

  close() {
    this.db.close();
  }
}

module.exports = { SponsioStore };
