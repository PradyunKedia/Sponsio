# Sponsio: High-Velocity Coordination Engine
## Architecture Blueprint & Operational Specification

### 1. Executive Summary & Core Paradigm
Sponsio is an on-chain, time-weighted coordination market where 100 participants dynamically allocate support across competing profiles within a strict 100-second execution window. 

Unlike traditional exogenous prediction markets that passively track external events, Sponsio operates as an **endogenous consensus engine**. The market state directly determines the outcome: collective participant capital, timing, and switching behaviors dictate the winning profile and the proportional settlement of the aggregate prize pool.

### 2. System Workflow & State Progression

**Phase 1: Genesis & Market Setup ($t = 0$ seconds)**
* 100 participants connect and commit $1,000$ base voting units each.
* The Global Prize Pool is escrowed at $100,000$ units.
* Automated pairwise assignment links every participant to an initial target profile.
* Initial State: Switch count $s_i = 0$, Active Equity $A_i = 1,000$, Timestamp $t_i = 0$.

**Phase 2: Real-Time Reallocation Loop ($t \in (0, 100)$ seconds)**
* A live leaderboard broadcasts the current Headcount (Unique Backers) and TVL for all profiles.
* Participants coordinate IRL, form alliances, and execute switches.
* When a participant executes a target switch:
  * Vacates the prior target; increments the new target's Headcount by $1$.
  * Deducts Active Equity based on the Loyalty Curve.
  * Surrenders Forfeited Tax to the Prize Pool.
  * Records the new timestamp $t_i$.

**Phase 3: Terminal Block & Market Freeze ($t = 100$ seconds)**
* Automatic transaction rejection via a hard block timestamp barrier.
* State evaluation determines the Winner ($W$) based on primary and tie-breaker metrics.

**Phase 4: Proportional Settlement (Post $t = 100$ seconds)**
* The $100,000$-unit Prize Pool is unlocked entirely for the active backers of $W$.
* Individual claims are settled proportionally based on Effective Claim Shares ($E_i$).

### 3. Economic Mechanics & Mathematics

**Fundamental Variables**
* $N = 100$: Total participant count.
* $V_0 = 1000$: Permanent, non-depleting voting weight per participant.
* $P_{\text{total}} = N \times V_0 = 100,000$: Fully locked global prize pool.
* $s_i \in \{0, 1, 2, 3, \dots\}$: Cumulative switches executed by participant $i$.
* $t_i \in [0, 100]$: Elapsed time (in seconds) of participant $i$'s most recent switch.

**The Loyalty Curve ($L(s)$)**
Determines the proportion of a participant's original base stake that remains as **Active Equity** ($A_i$) versus what is permanently surrendered as **Forfeited Tax** ($D_i$). 
* *Intention:* Heavily penalize indecision and late-stage bandwagon hopping. It converts switch friction directly into prize pool liquidity while preserving full voting power.

$$L(s) = \begin{cases} 
1.00 & s = 0 \quad (\text{Maintained initial assignment}) \\
0.85 & s = 1 \quad (\text{First strategic pivot}) \\
0.60 & s = 2 \\
0.40 & s = 3 \\
0.15 & s \ge 4 
\end{cases}$$

$$\text{Active Equity Stake: } A_i = 1000 \times L(s_i)$$
$$\text{Forfeited Tax: } D_i = 1000 \times (1 - L(s_i))$$

**Soft Time-Decay Curve ($T(t)$)**
A linear time modifier that scales efficiency.
* *Intention:* Reward early capital commitment while preserving sufficient late-game efficiency ($80\%$) to enable dynamic, last-second comebacks.

$$T(t) = 1.00 - \left( \frac{0.20 \times t}{100} \right) = 1.00 - 0.002 \times t$$

**Effective Claim Shares ($E_i$)**
At settlement, a participant's claim weight on the prize pool is determined by the intersection of their Active Equity and their Time Modifier.

$$E_i = A_i \times T(t_i) = 1000 \times L(s_i) \times (1.00 - 0.002 \times t_i)$$

**Settlement & Distribution Logic**
* *Primary Win Selection:* $W = \arg\max_k (\text{Unique Backers}_k)$
* *Deterministic Tie-Breaker:* $W_{\text{resolved}} = \arg\max_{k \in \text{Tied}} \left( \sum_{i \in \text{Backers}(k)} A_i \right)$
* *Payout Allocation (100% to Backers):* $\text{Payout}_i = P_{\text{total}} \times \left( \frac{E_i}{\sum_{j \in \text{Backers}(W)} E_j} \right)$

### 4. Incentive Architecture & Behavioral Game Theory

* **Anti-Bandwagon Mechanism (The Dilution Trap):** Backing the obvious market leader dilutes the prize pool across dozens of participants. A late hopper who switched multiple times enters with a diminished share base (e.g., $E_i \approx 328$ vs. an early backer's $980$), resulting in net yields that can fall below the initial $1,000$-unit commitment.
* **Underdog Coalition Incentive:** Orchestrating a late-stage upset behind an underdog with only 3 to 4 backers splits the identical $100,000$-unit pool among a minimal group, yielding massive single-participant returns. This directly incentivizes off-screen social coordination and cartel formation.
* **Decoupled Voting vs. Equity Power:** Voting weight ($V_0 = 1000$) never diminishes, meaning every participant can alter the leaderboard standings at second 99 just as effectively as at second 1. However, equity claims degrade with excessive switching, preventing riskless board manipulation.

### 5. Architectural Decisions & Alternatives Analysis

| Decision Dimension | Selected Model | Alternative Options Considered | Rationale for Rejection |
|---|---|---|---|
| **Win Metric** | **Headcount (Unique Backers)** | Total Value Locked (TVL) | TVL creates pay-to-win dynamics where capital volume overrides collective coordination. Headcount prioritizes social lobbying and equal voting influence. |
| **Tie-Breaker** | **TVL** | Earliest Timestamp Reached | Timestamps introduce block-indexing edge cases. TVL serves as an objective secondary metric measuring aggregate capital conviction. |
| **Prize Allocation** | **100% to Active Backers** | 85% Backers / 15% Royalty | Awarding fixed cuts to creators rewards passive participants. A 100% allocation aligns returns entirely with financial, timing, and switching risk. |
| **Switch Penalty** | **Loyalty Multiplier ($L(s)$)** | Exponential Surcharge | Absolute surcharges deplete balances rapidly, forcing players into passive lock-outs. The Loyalty Curve scales equity decay while keeping players fully armed. |
| **Time Decay** | **Soft Linear Decay** | Aggressive Linear Decay | Aggressive decay reduces late-game efficiency to near zero, freezing market activity. Soft decay maintains an 80% baseline efficiency, keeping the board dynamic. |
| **Market Visibility** | **100% Full Transparency** | 30-Second Terminal Blackout | Full transparency enables real-time bank runs, counter-raids, and transparent market contention up to the final second. |

### 6. Protocol Generalization & Utility

While structured as an interactive coordination game, the engine functions as a High-Throughput Decentralized Consensus Primitive for rapid collective decision-making. Potential real-world implementations include:
* **Security Bounty Triage:** Researchers stake on critical threats; time-decay rewards early zero-day discovery while indecision penalties filter spam.
* **DAO Fast-Track Voting:** Timeboxed coordination replaces multi-week voting for emergency proposals.
* **Public Goods Curation:** Crowd-curated grant allocation routes capital dynamically based on verifiable conviction.

The protocol leverages high-performance infrastructure—specifically tailored for environments capable of 10,000 TPS, 0.3s block times, and 0.6s finality—to ensure that high-frequency state contention in the final milliseconds does not result in dropped transactions or gas spikes.
