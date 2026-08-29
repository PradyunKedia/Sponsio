# Sponsio

[![CI](https://github.com/PradyunKedia/Monad_Hack/actions/workflows/ci.yml/badge.svg)](https://github.com/PradyunKedia/Monad_Hack/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-7B68EE.svg)](LICENSE)

Sponsio is a real-time multiplayer coordination market on Monad Testnet. Between 2 and 100 people join a room with MetaMask, pitch their projects, and spend 100 seconds backing one another. Switching remains possible throughout the round, but loyalty and time-decay reduce a switcher's payout weight. Headcount decides the winner; surviving effective equity decides how the escrowed pool is split.

## Public deployment

- GitHub: <https://github.com/PradyunKedia/Monad_Hack>
<!-- SPONSIO_LIVE_START -->
- Live app: **deployment pending**
<!-- SPONSIO_LIVE_END -->
<!-- SPONSIO_CONTRACT_START -->
- Monad Testnet contract: [`0x27b2417caA861379ec739D0a583EaE5Aa0e283b4`](https://testnet.monadscan.com/address/0x27b2417caA861379ec739D0a583EaE5Aa0e283b4)
<!-- SPONSIO_CONTRACT_END -->
- Explorer: <https://testnet.monadscan.com>
- Network: Monad Testnet, chain ID `10143`

Do not replace these placeholders until the public frontend/backend and contract are actually live. The deployment commands below produce the contract address and explorer link.

## What works

- Multiple isolated rooms with any size from 2–100 players
- MetaMask wallet connection and forced Monad Testnet network selection
- Wallet-signed, nonce-protected room authentication
- Persistent SQLite room/session/event state with restart recovery
- Authoritative WebSocket countdown, leaderboard, reconnect, and idempotent switches
- Even and odd participant assignment
- On-chain testnet MON escrow per room
- O(1) room creation/join/refund and O(log N) Merkle payout claims
- Operator timeout with individual player refunds
- Public projector/player-board data
- 100-client concurrent WebSocket load test

## Architecture

The backend owns latency-sensitive live gameplay. Monad Testnet owns funds and settlement.

1. The backend operator creates an escrow room on `Sponsio.sol`.
2. Players connect MetaMask, switch to Monad Testnet, sign a login challenge, and call `joinRoom`.
3. The room host starts with any 2–100 joined players.
4. Switches travel over authenticated WebSockets and are persisted as an ordered event log.
5. At 100 seconds, the backend calculates the winner and publishes a state hash plus Merkle payout root.
6. Winning players claim directly from the contract. If the operator does not settle, every player can refund independently.

The hybrid trust model is explicit: the contract guarantees escrow, payout limits, one claim per player, and refunds. The operator attests to live-game accounting through the published state and payout roots.

## Prerequisites

- Node.js 22+
- MetaMask
- Monad Testnet MON from <https://faucet.monad.xyz>
- A funded Monad Testnet operator/deployer wallet

Monad Testnet was reset from genesis on 2025-12-16. Never reuse an address from an earlier deployment.

## Install

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

## Configure and deploy the contract

```bash
cp .env.example .env
```

Set `DEPLOYER_PRIVATE_KEY` in `.env`. Keep the `0x` prefix and never commit this file.

```bash
npm test
npm run deploy:testnet
```

The deployment is written to `deployments/monad-testnet.json`. Copy its address into:

```bash
cp backend/.env.example backend/.env
```

Set these backend values:

```env
SPONSIO_TESTNET_ADDRESS=0xYourDeployedAddress
OPERATOR_PRIVATE_KEY=0xYourOperatorPrivateKey
SESSION_SECRET=a-long-random-production-secret
CORS_ORIGIN=https://your-public-frontend.example
```

The operator configured by the backend must be funded with testnet MON to create, start, and settle rooms.

## Verify source on Monad explorers

After deployment:

```bash
npm run verify:testnet
```

This submits the Solidity standard JSON and compiler metadata to the Monad verification API, which publishes source across supported explorers. Confirm the source is visible at:

```text
https://testnet.monadscan.com/address/YOUR_CONTRACT_ADDRESS
```

## Run locally

Terminal 1:

```bash
npm --prefix backend start
```

Terminal 2:

```bash
cp frontend/.env.example frontend/.env
npm --prefix frontend run dev
```

Open <http://localhost:5173>, create a room, and share its six-character room code or `?room=CODE` link. The creator's first joined wallet becomes the host. The host can start once at least two wallets have joined.

## Tests

```bash
npm test
npm --prefix backend test
npm --prefix backend run load-test
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

The load test connects 100 authenticated WebSocket clients, submits simultaneous switches, and verifies that headcounts and client sequences remain consistent.

## Monad Testnet details

- Chain ID: `10143`
- Currency: `MON`
- RPC: <https://testnet-rpc.monad.xyz>
- WebSocket RPC: `wss://testnet-rpc.monad.xyz`
- Monadscan: <https://testnet.monadscan.com>
- MonadVision: <https://testnet.monadvision.com>
- Faucet: <https://faucet.monad.xyz>

The public QuickNode endpoint is limited to 50 requests/second and 25 requests/second for `eth_call` and `eth_estimateGas`. Sponsio rate-limits backend membership checks to remain below that ceiling. Monad charges based on transaction gas limit, so frontend contract calls use measured estimates with at most a 10% buffer.

## Public hosting

The included Docker image builds the frontend and serves it from the same Node process as the API and WebSocket server:

```bash
docker build -t sponsio .
docker run --env-file backend/.env -p 3001:3001 -v sponsio-data:/data sponsio
```

Deploy this image to any container host with persistent disk support and WebSocket upgrades. Alternatively, deploy the backend and `frontend/dist` separately. Then:

[Deploy on Render](https://render.com/deploy?repo=https://github.com/PradyunKedia/Monad_Hack)

1. Set backend `CORS_ORIGIN` to the frontend URL.
2. Set frontend `VITE_API_URL` and `VITE_WS_URL` to the public backend before building.
3. Update the live URL and contract address at the top of this README.
4. Run a two-wallet public round and record the create, join, settlement, and claim transactions.

For horizontal scaling beyond one Node instance, move SQLite to Postgres/Redis and route each room to one authoritative worker. The current single-instance design is tested for 100 simultaneous players per room.

## Judging checklist

- [x] Public GitHub repository
- [ ] Live public page added to this README
- [ ] Monad Testnet contract address added to this README
- [ ] Contract deployed and source verified
- [ ] Public frontend/backend hosting
- [x] Announced multiplayer functions implemented
- [ ] Live on-chain transaction demonstrated
- [x] Reproducible setup and test commands documented
- [ ] Social launch post tagging `@monad`, `@monad_dev`, and `@geeky_kartikey`
- [ ] 30+ second product demo video
- [ ] Creative advertisement video

Optional organizer points after the required testnet demo: deploy a separately reviewed release to Monad Mainnet and attach the public page to a custom domain. Mainnet is intentionally not enabled by this repository's current deployment script.

## Economic model

- Base weight: 1,000 units
- Loyalty multipliers by switch count: `1.00`, `0.85`, `0.60`, `0.40`, then `0.15`
- Time multiplier: linear from `1.00` to `0.80` during the 100-second round
- Winner: highest unique-backer headcount, then active equity, then lowest profile index
- Payout: full escrow pool split among winner backers by effective equity

See [SPONSIO_PLAN.md](SPONSIO_PLAN.md) for the original mechanism design.

Submission materials:

- [Points checklist](docs/JUDGING_CHECKLIST.md)
- [Demo video runbook](docs/VIDEO_RUNBOOK.md)
- [Creative ad storyboard](docs/AD_STORYBOARD.md)
- [Social launch copy](docs/SOCIAL_PACK.md)
- [Ethical 5K-view launch plan](docs/VIEW_GROWTH_PLAN.md)
- [Pre-market fit and revenue](docs/PMF_AND_REVENUE.md)
- [Public launch and custom domain](docs/LAUNCH_AND_DOMAIN.md)
- [Pitch runbook](PITCH.md)
