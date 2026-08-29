require('dotenv').config();
const { loadConfig } = require('./src/config');
const { SponsioStore } = require('./src/store/database');
const { WalletAuth } = require('./src/auth/wallet');
const { RoomManager } = require('./src/game/roomManager');
const { createServer } = require('./src/server');
const { createSettlementClient } = require('./src/chain/settlement');

const config = loadConfig();
const store = new SponsioStore(config.DATA_DIR);
const auth = new WalletAuth(store, config.SESSION_SECRET);
const roomManager = new RoomManager(store, config);
const chain = createSettlementClient(config);
const { server } = createServer({ config, roomManager, auth, chain });

server.listen(config.PORT, () => {
  console.log(`Sponsio backend listening on http://localhost:${config.PORT}`);
  console.log('Network: Monad Testnet');
});

function shutdown() {
  roomManager.close();
  server.close(() => {
    store.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
