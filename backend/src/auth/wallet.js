const crypto = require('node:crypto');
const { getAddress, verifyMessage } = require('viem');
const { monadTestnet } = require('viem/chains');

function normalizeAddress(address) {
  return getAddress(address).toLowerCase();
}

function buildJoinMessage({ roomId, address, nonce, domain = 'Sponsio' }) {
  return [
    `${domain} wants you to join room ${roomId}.`,
    '',
    `Address: ${getAddress(address)}`,
    `Chain ID: ${monadTestnet.id}`,
    `Nonce: ${nonce}`,
    '',
    'This signature proves wallet ownership and does not send a transaction.',
  ].join('\n');
}

function tokenHash(token, secret) {
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

class WalletAuth {
  constructor(store, secret) {
    this.store = store;
    this.secret = secret;
  }

  issueNonce(roomId, address) {
    const normalized = normalizeAddress(address);
    const nonce = crypto.randomBytes(16).toString('hex');
    const expiresAt = Date.now() + 5 * 60_000;
    this.store.saveNonce(roomId, normalized, nonce, expiresAt);
    return {
      nonce,
      message: buildJoinMessage({ roomId, address: normalized, nonce }),
      expiresAt,
      chainId: monadTestnet.id,
    };
  }

  async verifyAndCreateSession({ roomId, address, nonce, signature }) {
    const normalized = normalizeAddress(address);
    if (!this.store.consumeNonce(roomId, normalized, nonce)) {
      throw new Error('Nonce is invalid or expired');
    }
    const message = buildJoinMessage({ roomId, address: normalized, nonce });
    const valid = await verifyMessage({ address: normalized, message, signature });
    if (!valid) throw new Error('Wallet signature is invalid');

    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + 2 * 60 * 60_000;
    this.store.saveSession(tokenHash(token, this.secret), roomId, normalized, expiresAt);
    return { token, expiresAt, address: normalized };
  }

  authenticate(token) {
    if (!token) return null;
    const session = this.store.getSession(tokenHash(token, this.secret));
    if (!session || session.expiresAt < Date.now()) return null;
    return session;
  }
}

module.exports = { WalletAuth, normalizeAddress, buildJoinMessage };
