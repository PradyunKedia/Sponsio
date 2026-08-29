const path = require('node:path');
const { z } = require('zod');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  SESSION_SECRET: z.string().min(16).default('dev-only-change-this-secret'),
  ADMIN_SECRET: z.string().min(8).default('dev-admin'),
  DATA_DIR: z.string().default(path.join(__dirname, '..', 'data')),
  ROOM_CAPACITY: z.coerce.number().int().min(2).max(100).default(100),
  GAME_DURATION_SEC: z.coerce.number().int().min(10).max(600).default(100),
  COUNTDOWN_SEC: z.coerce.number().int().min(0).max(30).default(3),
  ROOM_TTL_MIN: z.coerce.number().int().min(5).default(60),
  ROOM_STAKE_WEI: z.string().regex(/^\d+$/).default('1000000000000000'),
  MONAD_TESTNET_RPC_URL: z.string().url().default('https://testnet-rpc.monad.xyz'),
  SPONSIO_TESTNET_ADDRESS: z.string().optional(),
  OPERATOR_PRIVATE_KEY: z.string().optional(),
});

function loadConfig(env = process.env) {
  const config = schema.parse(env);
  if (config.NODE_ENV === 'production' && config.SESSION_SECRET.startsWith('dev-only')) {
    throw new Error('SESSION_SECRET must be configured in production');
  }
  return config;
}

module.exports = { loadConfig };
