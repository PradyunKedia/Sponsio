const { z } = require('zod');

const address = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const roomCode = z.string().trim().min(4).max(12).transform((value) => value.toUpperCase());

const createRoomSchema = z.object({
  label: z.string().trim().min(1).max(60).optional(),
  capacity: z.number().int().min(2).max(100).optional(),
});

const nonceSchema = z.object({ roomCode, address });

const joinSchema = z.object({
  address,
  username: z.string().trim().min(1).max(14),
  description: z.string().trim().min(10).max(160),
  nonce: z.string().min(16).max(128),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
  joinTxHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).nullable().optional(),
});

const switchSchema = z.object({
  type: z.literal('switch'),
  profileIndex: z.number().int().min(0),
  clientSeq: z.number().int().positive(),
});

module.exports = { createRoomSchema, nonceSchema, joinSchema, switchSchema };
