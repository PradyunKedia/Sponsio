const {
  concat,
  encodeAbiParameters,
  http,
  keccak256,
  createPublicClient,
  createWalletClient,
  stringToHex,
} = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { monadTestnet } = require('viem/chains');

const settlementAbi = [
  {
    type: 'function',
    name: 'createRoom',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'roomId', type: 'bytes32' },
      { name: 'operator', type: 'address' },
      { name: 'stake', type: 'uint128' },
      { name: 'maxPlayers', type: 'uint16' },
      { name: 'joinDeadline', type: 'uint64' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'startRoom',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'roomId', type: 'bytes32' },
      { name: 'gameEnd', type: 'uint64' },
      { name: 'settleDeadline', type: 'uint64' },
      { name: 'claimDeadline', type: 'uint64' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'hasJoined',
    stateMutability: 'view',
    inputs: [
      { name: 'roomId', type: 'bytes32' },
      { name: 'player', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'commitSettlement',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'roomId', type: 'bytes32' },
      { name: 'winningProfile', type: 'uint256' },
      { name: 'stateRoot', type: 'bytes32' },
      { name: 'payoutsRoot', type: 'bytes32' },
      { name: 'totalPayout', type: 'uint256' },
    ],
    outputs: [],
  },
];

function roomIdToBytes32(roomId) {
  return keccak256(stringToHex(roomId));
}

function payoutLeaf(roomId, address, amount) {
  return keccak256(encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }],
    [roomId, address, amount],
  ));
}

function hashPair(a, b) {
  return keccak256(concat(a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a]));
}

function buildPayoutTree(roomId, weightedPayouts, poolWei) {
  const pool = BigInt(poolWei);
  const totalWeight = weightedPayouts.reduce(
    (sum, payout) => sum + BigInt(payout.effectiveEquity),
    0n,
  );
  const payouts = weightedPayouts
    .slice()
    .sort((a, b) => a.address.localeCompare(b.address))
    .map((payout) => ({
      address: payout.address,
      amount: totalWeight === 0n
        ? 0n
        : (pool * BigInt(payout.effectiveEquity)) / totalWeight,
    }));
  const distributed = payouts.reduce((sum, payout) => sum + payout.amount, 0n);
  if (payouts.length) payouts[0].amount += pool - distributed;

  let layer = payouts.map((payout) => payoutLeaf(roomId, payout.address, payout.amount));
  const layers = [layer];
  while (layer.length > 1) {
    const next = [];
    for (let index = 0; index < layer.length; index += 2) {
      next.push(index + 1 < layer.length ? hashPair(layer[index], layer[index + 1]) : layer[index]);
    }
    layer = next;
    layers.push(layer);
  }
  const root = layer[0] || `0x${'00'.repeat(32)}`;
  payouts.forEach((payout, payoutIndex) => {
    let index = payoutIndex;
    payout.proof = [];
    for (let level = 0; level < layers.length - 1; level += 1) {
      const sibling = index % 2 === 0 ? index + 1 : index - 1;
      if (sibling < layers[level].length) payout.proof.push(layers[level][sibling]);
      index = Math.floor(index / 2);
    }
    payout.amount = payout.amount.toString();
  });
  return { root, payouts, totalPayout: pool.toString() };
}

function createSettlementClient(config) {
  if (!config.SPONSIO_TESTNET_ADDRESS || !config.OPERATOR_PRIVATE_KEY) return null;
  const transport = http(config.MONAD_TESTNET_RPC_URL);
  const publicClient = createPublicClient({ chain: monadTestnet, transport });
  const account = privateKeyToAccount(config.OPERATOR_PRIVATE_KEY);
  const walletClient = createWalletClient({ account, chain: monadTestnet, transport });
  let readQueue = Promise.resolve();

  function rateLimitedRead(operation) {
    const result = readQueue.then(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return operation();
    });
    readQueue = result.catch(() => {});
    return result;
  }

  async function write(functionName, args) {
    const request = await publicClient.simulateContract({
      account,
      address: config.SPONSIO_TESTNET_ADDRESS,
      abi: settlementAbi,
      functionName,
      args,
    });
    const estimate = await publicClient.estimateContractGas(request.request);
    const hash = await walletClient.writeContract({
      ...request.request,
      gas: estimate + estimate / 10n,
    });
    return publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });
  }

  return {
    operatorAddress: account.address.toLowerCase(),
    async createRoom({ roomId, stake, capacity, joinDeadline }) {
      return write('createRoom', [
        roomId,
        account.address,
        BigInt(stake),
        capacity,
        BigInt(joinDeadline),
      ]);
    },
    async startRoom({ roomId, gameEnd, settleDeadline, claimDeadline }) {
      return write('startRoom', [
        roomId,
        BigInt(gameEnd),
        BigInt(settleDeadline),
        BigInt(claimDeadline),
      ]);
    },
    async hasJoined(roomId, address) {
      return rateLimitedRead(() => publicClient.readContract({
        address: config.SPONSIO_TESTNET_ADDRESS,
        abi: settlementAbi,
        functionName: 'hasJoined',
        args: [roomId, address],
        blockTag: 'finalized',
      }));
    },
    async publish({ roomId, winningProfile, stateRoot, payoutsRoot, totalPayout }) {
      return write('commitSettlement', [
        roomId,
        winningProfile,
        stateRoot,
        payoutsRoot,
        BigInt(totalPayout),
      ]);
    },
  };
}

module.exports = {
  roomIdToBytes32,
  payoutLeaf,
  buildPayoutTree,
  createSettlementClient,
};
