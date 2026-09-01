# SPONSIO

[![License: MIT](https://img.shields.io/badge/License-MIT-7B68EE.svg)](LICENSE)

**Sponsio** is a fast-paced, 100-second live peer coordination market built for Monad. Unlike traditional prediction markets that observe external events, Sponsio is an **endogenous consensus mechanism** where the market's live state directly produces the decision.

Players enter the arena, pitch their proudest builds, and spend 100 seconds coordinating support. Switching targets is allowed at any moment, but **loyalty curves** and **soft time decay** penalize indecision and late bandwagons. Headcount decides the winning build, while surviving effective equity determines each backer's pro-rata share of the escrowed pool.

---

## The Mechanism & Mathematics

### 1. Starting Conditions & Fair Initialization
- Each room supports any arbitrary number of participants $L \ge 2$.
- Each player starts with a base stake $V_0 = 1,000$ votes.
- Total prize pool: $P = L \times V_0$.
- **Fair Initial Pairing**: At $t = 0$, participants are deterministically paired ($0 \leftrightarrow 1, 2 \leftrightarrow 3, \ldots$ with a 3-way cycle for odd counts). Every single profile starts with **exactly 1 backer**, preventing early monopoly.

### 2. Loyalty Curve $L(s)$
Every switch $s$ surrenders a percentage of active equity to the pool while preserving full voting weight:

| Switches ($s$) | Loyalty Multiplier $L(s)$ | Active Equity $A_i$ |
| :--- | :--- | :--- |
| **0** (Initial) | $1.00$ ($100\%$) | $1,000$ |
| **1** | $0.85$ ($85\%$) | $850$ |
| **2** | $0.60$ ($60\%$) | $600$ |
| **3** | $0.40$ ($40\%$) | $400$ |
| **$\ge 4$** | $0.15$ ($15\%$) | $150$ |

### 3. Soft Time Decay $T(t)$
Early conviction is rewarded without locking out late-game comebacks:
$$T(t) = \max\left(0.80,\, 1.00 - 0.002 \cdot t\right)$$
A participant's time term is locked at the moment of their final switch ($t_{\text{last}}$).

### 4. Effective Claim & Payout
The effective claim $E_i$ represents a player's proportional entitlement:
$$E_i = A_i \times T(t_i) = V_0 \times L(s_i) \times T(t_i)$$

- **Win Condition**: Headcount (most unique backers).
- **Tie-Breaker**: Highest sum of Active Equity ($\sum A_i$).
- **Payout**: $100\%$ of the escrowed pool splits strictly among the backers of the winning profile:
$$\text{Payout}_i = P \times \frac{E_i}{\sum_{j \in \text{Backers}(\text{Winner})} E_j}$$

---

## Retro Arcade User Experience

- **Multi-Game Canvas Backdrops**: 5 real-time canvas games rendering on a dynamic $1000 \times 1000$ logical grid (Breakout on Landing, dual-board Tetris on Onboarding, dual-board Pong on Waiting Room, Snake on Arena, Space Invaders on Final).
- **Interactive Joystick Console**: Top-down arcade joystick responsive to keyboard arrow keys (Up, Down, Left, Right, Diagonals) and mouse motion.
- **7-Segment LED Clock**: Glowing digital LED countdown timer.
- **Hybrid Typography**: Authentic arcade pixel marquee titles and badges (`Press Start 2P`) paired with clean, readable sans-serif typography (`Nunito` / `Inter`) for pitches, project bios, and forms.
- **MetaMask Authentication**: Seamless connection with account-switching permissions (`wallet_requestPermissions`) and user-friendly error traps.

---

## Project Structure

```
Monad-Hack/
├── contracts/
│   └── Sponsio.sol           # Solidity contract (pairing, loyalty curve, settlement)
├── frontend/
│   ├── index.html            # Vite entrypoint
│   ├── vite.config.js        # Vite + React 19 configuration
│   ├── src/
│   │   ├── App.jsx           # View router and screen wipe transitions
│   │   ├── ArcadeBackdrop.jsx# 5-game procedural canvas backdrop
│   │   ├── ArcadeConsole.jsx # 4-direction keyboard/mouse joystick
│   │   ├── FinalScreen.jsx   # Victory confetti & dynamic equity claim
│   │   ├── GameWindow.jsx    # 100s live arena, leaderboard, profile dossiers
│   │   ├── Landing.jsx       # Arcade attract start screen
│   │   ├── Onboarding.jsx    # Callsign, pitch, and MetaMask connection
│   │   ├── SevenSeg.jsx      # Vector 7-segment digital countdown
│   │   ├── WaitingRoom.jsx   # Dynamic queue lobby & dot matrix
│   │   └── index.css         # Hybrid arcade styling system
├── backend/
│   └── index.js              # Express mock AI registration & room status
├── test/
│   └── Sponsio.t.js          # Hardhat contract test suite
└── hardhat.config.js         # Hardhat configuration (Monad Testnet ready)
```

---

## Getting Started

### 1. Prerequisites
- **Node.js**: v18+ (Node.js 22 recommended)
- **npm**

### 2. Installation
Install all dependencies in root, frontend, and backend:
```bash
npm install
npm --prefix frontend install
npm --prefix backend install
```

### 3. Running Locally
Start the frontend development server:
```bash
npm --prefix frontend run dev
```
Open **`http://localhost:5173`** in your browser.

*(Optional)* Start the mock backend server:
```bash
npm --prefix backend start
```
Runs on **`http://localhost:3001`**.

---

## Testing & Smart Contract Verification

Run the Hardhat smart contract test suite:
```bash
npm test
```

Build the production frontend:
```bash
npm --prefix frontend run build
```

---

## License
MIT © Sponsio
