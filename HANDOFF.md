# Sponsio — Project Handoff & Session Export

> Written as a self-contained brief so a fresh reader (or another Hermes agent) can
> pick this up cold and understand what we're building, why, and where we left off.

---

## 1. The situation

**Event:** Monad Blitz New Delhi V4 — Saturday, August 29, 2026, Noida (9 AM–9 PM).

- One-day IRL hackathon, ~7 hours of actual build time.
- $1,500 prize pool (peer-judged by fellow builders — NOT external judges).
- Teams of up to 3. Consumer app required. "If it runs, it's fair game."
- **Applications close Aug 26** — registration is approval-required and capacity-limited.
- Project working directory contains `SPONSIO_PLAN.md`, the original mechanism
  spec quoted and analyzed below.

**Monad's specs (verified against monad.xyz):** 10,000 TPS, 0.3s block times,
0.6s finality, parallel EVM execution, complete EVM compatibility (Solidity works).

---

## 2. What we know about how these hackathons are judged

We reverse-engineered the two most relevant past winners:

**MonadLisa (won Seoul)** — a vanilla r/place clone. The *entire* contract is
~40 lines: `mapping(uint32 index => uint24) pixels` + `drawPixel()` + an event.
Next.js/wagmi frontend with a color picker and tx feed. No ownership, no economy.
It won on spectacle + zero-friction participation, not sophistication.

**Proof-of-Meet (won New Delhi V3 — same city, three editions ago)** — "Pokémon Go
for networking." Personalized Pokémon-style cards from social handles, live map of
nearby devs, physically walk to meet people, meeting someone mints a "Proof-of-Meet"
tx on Monad. Won on real-world social utility + collection flex.

**The meta-lesson:** both winners have the same DNA — *the room is the content.*
Zero learning curve (phone out, QR, playing in 30s), something to watch live on a
big screen, and a flex/artifact at the end. Peer judges reward "I played this and it
was fun" over "impressive architecture."

**Strategic consequence:** vanilla canvas = "MonadLisa again"; networking map =
"Proof-of-Meet again." Both lanes are burned ground. We need the fusion/new angle.

---

## 3. The idea we converged on: Sponsio

An **endogenous, time-weighted coordination market.** The core insight that makes it
work: unlike a prediction market that *predicts* an external event, here **the market
state directly determines the outcome.** The market doesn't observe reality — it *is*
the mechanism producing the decision.

### Mechanics (from SPONSIO_PLAN.md)

- N = 100 participants. Each commits a base stake V₀ = 1000 units.
- Total prize pool P = N × V₀ = 100,000 units, escrowed.
- Each participant is assigned to an initial "profile" and can **switch targets**
  during the window.
- The game runs a fixed window (currently 100 seconds), then freezes.

**Loyalty curve L(s)** — how much of your stake stays as "active equity" after s switches:

| switches s | L(s) |
|---|---|
| 0 | 1.00 |
| 1 | 0.85 |
| 2 | 0.60 |
| 3 | 0.40 |
| ≥4 | 0.15 |

Active equity `A_i = 1000 × L(s_i)`. Forfeited tax `D_i = 1000 × (1 − L(s_i))`
surrendered to the pool.

**Time decay T(t)** = `1 − 0.002t` (linear; 100% at t=0, 80% floor at t=100).
Rewards early commitment while keeping an 80% late-game efficiency floor for comebacks.

**Effective claim shares** `E_i = A_i × T(t_i) = 1000 × L(s_i) × (1 − 0.002·t_i)`.

**Win metric:** headcount = unique backers per profile (NOT TVL — deliberately, to
avoid pay-to-win). **Tie-breaker:** Σ A_i (total active equity of that profile's backers).

**Payout:** `Payout_i = P_total × E_i / Σ_{j ∈ Backers(winner)} E_j` (100% to backers
of the winning profile).

### Why the design decisions are deliberate

- **Headcount over TVL** → one person, one vote. Capital can't buy the outcome.
- **Loyalty curve** → taxes indecision and bandwagoning, converts switch-friction into
  pool liquidity, but keeps voting weight undiminished (everyone can still move the
  board at second 99).
- **Soft time decay** → rewards early conviction without freezing late activity.
- **Full transparency** → enables live bank-runs, counter-raids, real contention.

---

## 4. The game-theory analysis we did (important — this is the "why it works")

### Q: "Near the clock, won't everyone just pile onto the leader, and nobody loses?"

**No — the pile-on loses money.** Worked example (leader A has 40 backers at t=95,
60 players pile on):

- Early loyal backers (L=1.00, T=1.00): E = 1000 → payout = **$1,230** (gain ~230).
- Late pile-ons (first switch L=0.85, t=95 so T=0.81): E = 688.5 → payout = **$847**
  (loss ~153).

The pool is *fixed* at 100,000 — piling on doesn't grow it, it just re-slices it.
The herd's loss is exactly the loyalists' gain. Herding = donating to early backers.

### Q: Is herding even rational?

No. Counter-raid (60 players coordinate an upset behind underdog B, which had 5 backers):

- B ends with 65 > A's 40 → B wins (headcount rule).
- Switcher payout: **$1,487** (gain ~487). B's 5 loyalists: **$2,159** (gain ~1,159).

The upset pays ~2x the safe herd. The design *rewards* the counter-move, so "everyone
piles on" is the lazy fallback losers take when they can't coordinate — not the
equilibrium.

### Other findings

- **The whale can't buy the outcome.** Headcount means a whale is still ONE backer.
  Capital only amplifies *payout if they're right* — so a whale's rational move is
  "back the likely winner," not "push my bad idea." (Small hole: the tie-breaker
  ΣA_i is capital-weighted, so a whale swings ties. Patchable.)
- **Influence is the essence of any market.** Headcount removes the *unfair* channel
  (buying the outcome), not the *fair* one (persuading people). This is a feature.
- **Early majority is the true degenerate case.** If a profile hits 51+ backers
  before t=50, no upset is possible, the outcome is locked, and the game dies. The
  random-assignment start scatters backers at t=0, but nothing stops an early stampede.
- **Time decay is flat at the tail.** T goes 0.81 (t=95) → 0.80 (t=100), so "last-second
  switching" is barely punished *as a timing matter*; the loyalty curve does the real
  taxing. Fine for 100s, but know the narrative "punish late switching" is carried by
  L(s), not T(t).
- **Long-horizon caveat:** T(t) = 1 − 0.002t goes *negative* past t=500s. If this ever
  runs for weeks/months, the time term needs redefinition (asymptote, or decay only
  within a commitment window). L(s) and headcount generalize cleanly.

---

## 5. The pivot: from "game" to "decision engine" (the big idea)

The key realization (Sahitya's, and it's the load-bearing one):

**PolyMarket escapes "just gambling" because it has three legs** — ground truth
(resolves against reality), incentive (money on the line), aggregation (price = public
information). Sponsio, as written, has only two: incentive + aggregation.
It's *missing ground truth*, and that's the entire difference between a game and a
product.

An endogenous market (market *decides* the outcome) produces a winner, not information.
To make it useful, two honest paths:

- **Path A — prediction engine (exogenous):** profiles become real claims ("Team X ships
  by 6pm"). Loyalty curve + time decay become a novel *prediction mechanism*, runnable
  in a room in 100s. Differentiator vs PolyMarket = the mechanism, not the concept.
- **Path B — decision engine (endogenous):** profiles become real options the group must
  choose between (grant allocation, bounty triage, feature priority). Coordination IS the
  vote. Output = a decision + conviction-weighted ranking.

**The genuinely novel artifact** hiding in the design: the loyalty curve + time decay
aren't just game mechanics, they're **measurement instruments for conviction.** A poll
tells you *what* a group chose; this tells you *how decided* they were. "X won with
early, un-switched backing" vs "X won but 40% jumped in at t=99" are different truths,
and this quantifies them. That's the equivalent of PolyMarket's "price."

**Tagline (for judges):**
> PolyMarket turns opinions into prices. Sponsio turns a room's conviction into a decision.

---

## 6. Novelty check (so we don't overclaim)

The "decision engine" category is *not* new. Prior art to know before a judge asks:

- **Futarchy** (Robin Hanson, 2000) — "vote on values, bet on beliefs." Markets to make decisions.
- **Conviction voting** (Giveth, ~2019) — stake accrues power the longer you hold it.
- **Quadratic voting** (Posner & Weyl, *Radical Markets*) — marginal vote cost grows, anti-whale.

What's *actually* novel in ours, the delta to articulate:

1. **Endogenous** — market state is the outcome, not a bet resolving against reality.
2. **Decoupling** — headcount sets the outcome, equity sets the payout. Voting power is
   person-weighted, skin-in-the-game is capital-weighted, cleanly separated. Most
   governance does one or the other.
3. **Loyalty curve + time decay as anti-bandwagon instruments** — and note it's the
   *inverse* of conviction voting: Giveth says "time accrues power," ours says "time
   discounts late moves."

**Paper potential:** the game-theoretic claims (dilution trap, underdog coalition,
anti-bandwagon) are the seed of a mechanism-design paper. What's missing for it to be a
real contribution: formal equilibrium analysis (Nash equilibria, dominant strategy,
which loyalty-curve parameters make "stay loyal to good ideas" beat "bandwagon at the
buzzer," strategy-proofness). The hackathon demo and the research seed can come from
the same spec.

---

## 7. Naming

The final product name is **Sponsio**, Latin for a formal wager and the root of
"sponsor" and "response." It captures the mechanism's combination of staking,
collective choice, and conviction.

---

## 8. Open questions / risks to resolve

1. **Decision engine (B) vs prediction engine (A)?** Not fully locked. Forks the
   contract design. For the hackathon, leaning Path B with a real in-room decision.
2. **Onboarding friction is the #1 kill-risk.** 100 people must join in ~15s each or
   the demo dies. Needs embedded wallets / faucet QR, zero crypto jargon. Prototype
   THIS first, before game logic.
3. **100-second window is one-shot fragile.** Fix: multi-round (run 5–20 rounds across
   the day, "best coordinator" leaderboard). Turns a demo into a recurring event-game.
4. **Stakes are hollow as written.** "100,000 abstract units" has no pull. Needs a real
   reward/artifact (mint the winning profile, commemorative token, or make profiles
   concrete and memetic so the room cares).
5. **Tie-breaker needs a final fallback** (lowest profile index, or earliest timestamp).
   Headcount + ΣA_i can still tie.
6. **Last-second-switch UX:** a tx sent at t=99.9 landing after t=100 gets rejected by
   the freeze (correct, but players will be confused) — surface "market frozen, switch
   rejected" loudly.
7. **"Unique backers" is sybil-able** with multiple phones — but live/IRL it's
   human-verifiable. Have that answer ready ("anti-sybil via physical presence, not a bug").

---

## 9. Immediate next steps (offered, not yet executed)

- Lock Path A vs Path B.
- Lock win/equity mechanics + patch the tie-breaker hole.
- Design the "coordination surface" (what the live board shows, what signals players
  need to pull off a counter-raid).
- Scaffold the contract + the instant-onboarding layer.
- Collision-check the name.
- Write the mechanism up as a proper short-paper skeleton (model, definitions, the
  claims to prove) — doubles as the research seed.

---

*End of handoff. This document is meant to be read top-to-bottom by someone with no
prior context of the conversation. The full original spec is in SPONSIO_PLAN.md.*
