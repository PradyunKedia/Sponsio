import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
} from 'viem';
import { monadTestnet } from 'viem/chains';

const sponsioAbi = [
  {
    type: 'function',
    name: 'joinRoom',
    stateMutability: 'payable',
    inputs: [{ name: 'roomId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'roomId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
      { name: 'proof', type: 'bytes32[]' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'refund',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'roomId', type: 'bytes32' }],
    outputs: [],
  },
];

function requireMetaMask() {
  if (!window.ethereum?.isMetaMask) {
    throw new Error('MetaMask is required to play Sponsio on Monad Testnet.');
  }
  return window.ethereum;
}

export async function ensureMonadTestnet() {
  const provider = requireMetaMask();
  const chainHex = `0x${monadTestnet.id.toString(16)}`;
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainHex }],
    });
  } catch (error) {
    if (error.code !== 4902) throw error;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: chainHex,
        chainName: monadTestnet.name,
        nativeCurrency: monadTestnet.nativeCurrency,
        rpcUrls: [...monadTestnet.rpcUrls.default.http],
        blockExplorerUrls: [monadTestnet.blockExplorers.default.url],
      }],
    });
  }
}

export async function connectMetaMask() {
  const provider = requireMetaMask();
  await ensureMonadTestnet();
  const walletClient = createWalletClient({ chain: monadTestnet, transport: custom(provider) });
  const [account] = await walletClient.requestAddresses();
  return account;
}

export async function signRoomMessage(message, account) {
  const provider = requireMetaMask();
  const walletClient = createWalletClient({ chain: monadTestnet, transport: custom(provider) });
  return walletClient.signMessage({ account, message });
}

function clients(rpcUrl) {
  const provider = requireMetaMask();
  const transport = http(rpcUrl || monadTestnet.rpcUrls.default.http[0]);
  return {
    publicClient: createPublicClient({ chain: monadTestnet, transport }),
    walletClient: createWalletClient({ chain: monadTestnet, transport: custom(provider) }),
  };
}

async function write({ account, address, functionName, args, value, rpcUrl }) {
  if (!address) throw new Error('Sponsio Testnet contract is not configured.');
  await ensureMonadTestnet();
  const { publicClient, walletClient } = clients(rpcUrl);
  const gas = await publicClient.estimateContractGas({
    account,
    address,
    abi: sponsioAbi,
    functionName,
    args,
    value,
  });
  const hash = await walletClient.writeContract({
    account,
    address,
    abi: sponsioAbi,
    functionName,
    args,
    value,
    gas: gas + gas / 10n,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });
  if (receipt.status !== 'success') throw new Error('Monad Testnet transaction reverted.');
  return receipt;
}

export function joinOnChain({ account, contractAddress, roomId, stakeWei, rpcUrl }) {
  return write({
    account,
    address: contractAddress,
    functionName: 'joinRoom',
    args: [roomId],
    value: BigInt(stakeWei),
    rpcUrl,
  });
}

export function claimOnChain({ account, contractAddress, roomId, amount, proof, rpcUrl }) {
  return write({
    account,
    address: contractAddress,
    functionName: 'claim',
    args: [roomId, BigInt(amount), proof],
    rpcUrl,
  });
}

export function refundOnChain({ account, contractAddress, roomId, rpcUrl }) {
  return write({
    account,
    address: contractAddress,
    functionName: 'refund',
    args: [roomId],
    rpcUrl,
  });
}

export function explorerTx(hash) {
  return `${monadTestnet.blockExplorers.default.url}/tx/${hash}`;
}
