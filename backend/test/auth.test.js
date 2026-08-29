const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { privateKeyToAccount } = require('viem/accounts');
const { SponsioStore } = require('../src/store/database');
const { WalletAuth } = require('../src/auth/wallet');

test('wallet challenge creates a room-bound reconnect session', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sponsio-auth-'));
  const store = new SponsioStore(dir);
  const auth = new WalletAuth(store, 'test-session-secret-long');
  const account = privateKeyToAccount(`0x${'11'.repeat(32)}`);
  const challenge = auth.issueNonce('room-1', account.address);
  const signature = await account.signMessage({ message: challenge.message });
  const session = await auth.verifyAndCreateSession({
    roomId: 'room-1',
    address: account.address,
    nonce: challenge.nonce,
    signature,
  });

  assert.equal(auth.authenticate(session.token).roomId, 'room-1');
  await assert.rejects(
    auth.verifyAndCreateSession({
      roomId: 'room-1',
      address: account.address,
      nonce: challenge.nonce,
      signature,
    }),
    /Nonce is invalid or expired/,
  );
  store.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
