# BlitzConsensus

**BlitzConsensus** is a high-velocity, on-chain coordination engine designed for the Monad ecosystem. It acts as an endogenous consensus market where players dynamically allocate support across competing profiles within a strict 100-second execution window.

This project was built as a full-stack Web3 application, separating high-frequency state updates and AI generation into an off-chain backend, while enforcing rigorous financial game theory on-chain.

## 🏗 Architecture

The system is composed of three main layers:

1. **Smart Contracts (Blockchain Layer)**
   - Built with **Solidity** and tested using **Hardhat**.
   - Handles the 100-second coordination window, pairwise assignments, loyalty curve penalties, and proportional prize distribution.
   - Designed for high-throughput chains like Monad to handle rapid state contention.

2. **Off-Chain Backend (Express.js)**
   - Located in the `/backend` directory.
   - Acts as a high-speed state cache and AI proxy.
   - Accepts player registrations (a wallet address + the "craziest thing you've ever done"), mocks an AI response to generate an anonymous username, and stores the text off-chain to save gas.

3. **Frontend UI (Vite + React)**
   - Located in the `/frontend` directory.
   - Features a modern, dark glassmorphic aesthetic.
   - Contains a **Registration Portal** for onboarding.
   - Contains a **Player Board** (`/board`) for participants to browse AI usernames and original stories.
   - Contains a cinematic **Projector View** (`/projector`) designed for large screens to show real-time leaderboard standings at a hackathon.

---

## 🚀 Getting Started

To run the entire BlitzConsensus stack locally, you will need to start all three layers in separate terminal windows.

### 1. Smart Contracts
To run the local Hardhat blockchain and test the contracts:
```bash
# From the root directory
npm install
npx hardhat test
```
*(To run a local node, you can use `npx hardhat node`)*

### 2. Backend Server
To start the off-chain API and AI username generator:
```bash
cd backend
npm install
node index.js
```
*The backend will run on `http://localhost:3001`.*

### 3. Frontend UI
To launch the React application:
```bash
cd frontend
npm install
npm run dev
```
*The frontend will be available at `http://localhost:5173`.*

---

## 📖 Game Mechanics

- **Genesis**: Players enter the game and commit base voting units. They are pairwise assigned to an initial profile.
- **The 100-Second Loop**: A live leaderboard broadcasts the Headcount and Total Value Locked (TVL) for all profiles. Players form IRL alliances and switch profiles.
- **The Loyalty Curve**: Indecision is penalized. Every time a player switches, their "Active Equity" decays ($1.00 \rightarrow 0.85 \rightarrow 0.60 \dots$), permanently surrendering forfeited tax to the prize pool.
- **Time Decay**: Late-game switches receive slightly reduced efficiency to reward early commitment.
- **Settlement**: After 100 seconds, the profile with the highest Headcount (or highest TVL in a tie) wins. 100% of the prize pool is distributed proportionally to its backers based on their surviving Active Equity.
