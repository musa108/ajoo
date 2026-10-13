# Ajo On-Chain: Project Spec v0.1

Target: Monad Metropolis hackathon, onchain finance track (deadline Oct 13, 2026).
Status: pre-implementation. Written Oct 2, 2026.

---

## 0. Read this first: unverified items

These came from a list and public pages, not from the hackathon's rules (behind login). Resolve before writing code.

| # | Item | Why it matters | How to resolve |
|---|---|---|---|
| 1 | Eligibility from Nigeria, team size limits | Disqualification risk | Register at hackathon.monad.xyz, read rules |
| 2 | Is new code required (work started after Sep 1)? | Decides whether we may reuse LinkStore / Nodara code | Rules page |
| 3 | Testnet vs mainnet deployment requirement | Changes the deploy plan and token choice | Rules page |
| 4 | Which stablecoin exists on Monad and its address | The product is stablecoin-denominated | Monad docs / explorer. Until confirmed, use a mock ERC-20 with a configurable address |
| 5 | Exact judging criteria and submission format (video length, repo, deck) | Shapes the demo and landing page | Rules page |
| 6 | Whether a Monad-specific feature is expected or only rewarded | Shapes the "why Monad" pitch | Rules page, Discord |

Nothing below depends on these being answered, but the deploy and demo plan may change.

---

## 1. One-liner and pitch

**Ajo** puts the rotating savings circle (ajo, esusu, susu, tanda, chit fund) on-chain. Members contribute a fixed amount each cycle, one member receives the whole pot each cycle, and every on-time payment builds a portable, on-chain reputation that can later unlock credit.

**Problem.** Informal savings circles move billions across Africa, South Asia, and Latin America, but they run on trust in one organizer. Organizers run off with the pot, members default after being paid, records live in a notebook or WhatsApp group, and good behavior earns nothing outside the group.

**Why on-chain.** Funds sit in a contract, not with a person. Rules (order, deadlines, penalties) are enforced by code. Contribution history is public and portable.

**Why Monad.** Low fees and fast finality make small, frequent contributions ($1 to $5 daily or weekly) practical, and settlement feels instant. A circle that pays out the moment the last member contributes is a good live demo of that.

**Track fit.** Onchain finance. The track brief lists "undercollateralised lending priced on onchain credit history". Ajo builds the credit history first (the hard part) and ships a minimal credit line as the stretch goal.

---

## 2. Scope

### Must ship (MVP, demoable end to end)

1. Create a circle: token, contribution amount, period, member count, deposit, payout order mode.
2. Join a circle (with deposit) until full, then the circle starts.
3. Contribute each cycle; the recipient is paid automatically when the cycle settles.
4. Settle cycle logic: covers missed contributions from the member's deposit, records on-time / late / default.
5. Reputation registry updated by circles, readable by anyone, non-transferable.
6. Web app: create / join / contribute / view circles, member status, pot progress, reputation profile.
7. Keeper that settles cycles and sends reminders.
8. Landing page in house style (see section 9).
9. Deployed contracts, verified, with a seeded demo circle.

### Stretch (only after the above is stable)

- Micro-credit line: a lender pool that lends to wallets above a reputation threshold, with repayment feeding back into the score.
- Telegram / WhatsApp bot for reminders and "pay now" deep links.
- Embedded-wallet login so first-time users need no browser extension.
- AI assistant that explains a circle's terms in plain language and flags risky terms.

### Explicitly out of scope

- Fiat on/off-ramp (state this honestly in the pitch as "next step").
- Custody by us of anything beyond the contracts.
- Legal / regulatory compliance. Pooled savings and lending are regulated activities in many jurisdictions including Nigeria. This is a prototype on a test or demo setup, and the pitch should not claim otherwise.
- Cross-chain, NFTs, tokens of our own.

---

## 3. Users and core flows

**Personas.** (a) Organizer: sets up a circle for friends, a market association, or a church group. (b) Member: wants a disciplined way to save and a proof of reliability. (c) Observer / lender (stretch): reads reputation to price credit.

**Flow A: create and fill.** Organizer sets terms, shares a join link. Members connect a wallet, approve the token, join (deposit locked). When the last seat fills, the first cycle starts.

**Flow B: a cycle.** Each member pays the contribution during the cycle window. The recipient for that cycle is determined by slot. When everyone has paid, or the deadline plus grace passes, anyone (usually the keeper) calls settle. The recipient receives the pot.

**Flow C: default.** Member misses the deadline plus grace. Their deposit covers the contribution for that cycle, their record shows a default, and their score drops. If the deposit is already exhausted, the member is flagged as defaulted (see risk model).

**Flow D: finish.** After the last cycle, deposits are refunded (minus any consumed), a completion bonus is written to reputation, and the circle closes.

---

## 4. Smart contract design

Language / tooling: Solidity ^0.8.24, Foundry, OpenZeppelin (SafeERC20, ReentrancyGuard, Ownable2Step where needed). EVM target: Monad (EVM-compatible). Verify the compiler / EVM version setting against Monad's docs before deploying.

### 4.1 Contracts

| Contract | Responsibility |
|---|---|
| `AjoFactory` | Deploys circles (minimal proxy clones), keeps the list, registers each circle as an authorized reputation writer |
| `AjoCircle` | One savings circle: membership, deposits, cycles, payouts, defaults |
| `ReputationRegistry` | Per-address score and stats, writable only by registered circles, no transfer |
| `MockUSD` (testnet only) | Mintable ERC-20 with 6 decimals for demos |
| `CreditPool` (stretch) | Lender deposits, borrower limits from score, repayment, default reporting |

### 4.2 `AjoCircle` parameters (immutable after creation)

```
token              address   ERC-20 used for contributions and deposits
contribution       uint256   amount per member per cycle
memberCount        uint8     2..12 (cap for gas and UX)
period             uint32    seconds per cycle
grace              uint32    seconds after cycle end before default can be recorded
depositMultiple    uint8     deposit = contribution * depositMultiple (default 1)
orderMode          enum      JOIN_ORDER | REPUTATION_ORDER
joinDeadline       uint64    if not full by then, members can withdraw and the circle is cancelled
```

### 4.3 State machine

```
OPEN ── (full) ──► ACTIVE ── (last cycle settled) ──► COMPLETED
  │
  └── (joinDeadline passed, not full) ──► CANCELLED  (deposits refundable)
```

### 4.4 Core functions (interface sketch)

```solidity
function join() external;                       // pulls deposit, adds member, starts circle when full
function leaveBeforeStart() external;           // OPEN only, refunds deposit
function contribute() external;                 // current cycle only, once per member per cycle
function settleCycle() external;                // callable by anyone when allowed (see below)
function claimRefund() external;                // CANCELLED or COMPLETED, returns remaining deposit

function currentCycle() external view returns (uint8);
function recipientOf(uint8 cycle) external view returns (address);
function memberStatus(address m) external view returns (MemberState memory);
function cycleInfo(uint8 cycle) external view returns (CycleInfo memory);
```

`settleCycle` is allowed when either (a) every active member has contributed for the current cycle, or (b) `block.timestamp > cycleEnd + grace`. Cycle `k` runs from `startTime + k * period` to `startTime + (k+1) * period`. Early settlement pays out immediately; the next cycle still starts on schedule.

Settlement steps, in order:
1. For each member who has not contributed: if deposit >= contribution, deduct it and mark `DEFAULT_COVERED`; otherwise mark `DEFAULTED` and add nothing to the pot.
2. Pot = contributions received + deposit coverage.
3. Transfer pot to the cycle's recipient (checks-effects-interactions, `nonReentrant`).
4. Write reputation events for all members.
5. Advance cycle, or complete the circle.

### 4.5 Payout order

- `JOIN_ORDER`: slot = join position.
- `REPUTATION_ORDER`: when the circle fills, sort members by score descending, ties by join position. Highest reputation receives first. Sorting at most 12 members on-chain is cheap enough. This also gives new members a reason to build reputation: it moves them earlier in future circles.

### 4.6 Reputation scoring (parameters are tunable)

Score range 0 to 1000, new wallet starts at 0.

| Event | Change |
|---|---|
| On-time contribution | +10, scaled by circle value tier (x1, x1.5, x2) |
| Late contribution (inside grace) | -5 |
| Default covered by deposit | -60 |
| Defaulted with no deposit left | -200 |
| Circle completed with no defaults | +50 bonus |

Stored per address: `score`, `onTime`, `late`, `defaults`, `circlesCompleted`, `totalContributed`. Emit an event on every change so an indexer can rebuild history.

Credit limit (stretch) = `0` below score 400; above that, `(score - 400) * unit`, capped. Tune later.

### 4.7 Risk model: honest limits

| Risk | Mitigation | Remaining gap |
|---|---|---|
| Early recipient defaults after being paid | Deposit, and `REPUTATION_ORDER` puts proven members first | A deposit of 1x contribution does not cover (n-1) future contributions. A first-slot defaulter can still leave a shortfall, which reduces later recipients' pots. |
| Sybil reputation farming (new wallets in friendly circles) | Value-tiered scoring; show circle size and counterparties in the profile | Not solved. A real fix needs identity or attestation. Say so. |
| Organizer abuse | Organizer has no custody or privileged functions after creation | None beyond parameter choice |
| Token risk (depeg, blacklist) | Only whitelisted tokens in the factory | Depends on the issuer |
| Contract bugs | Foundry unit + fuzz + invariant tests, minimal surface | Not audited. State that clearly. |

Optional safer mode: `depositMultiple = memberCount - 1` gives full collateral for unknown wallets. It defeats part of the point of ajo but is useful as a setting for strangers.

### 4.8 Events

`CircleCreated`, `MemberJoined`, `CircleStarted`, `Contributed`, `CycleSettled`, `MemberDefaulted`, `PayoutSent`, `CircleCompleted`, `CircleCancelled`, `ReputationUpdated`.

### 4.9 Test plan (Foundry)

- Unit: every function, every revert path, rounding (token decimals), duplicate contribution, wrong cycle, join when full, leave after start.
- Fuzz: contribution amounts, member counts 2..12, random subsets of members defaulting.
- Invariants: tokens held by the circle always equal outstanding deposits plus unpaid pot; sum of payouts never exceeds sum of inflows; each member receives exactly one payout.
- Scenario scripts: happy path 5 members x 5 cycles; one default covered; one default uncovered; cancelled circle refund.

---

## 5. Off-chain components

**Web app** (Next.js App Router, TypeScript, Tailwind, shadcn/ui, wagmi + viem). Reads contract state directly with viem; no backend needed for core views.

**Keeper / notifier** (Node + TypeScript, small NestJS or plain service). Polls circles, calls `settleCycle` when allowed, sends reminders (email or Telegram) before deadlines. Uses a funded hot wallet with a spend cap. Anyone can also call settle manually from the UI, so the product does not depend on our keeper. Reuse the polling-engine pattern from Nodara only if the rules allow reusing earlier code.

**Indexer (optional).** Prisma + PostgreSQL storing events for the reputation timeline and leaderboards. Skip if reading events through viem is fast enough for the demo.

---

## 6. Frontend screens

1. **Landing** (section 9).
2. **Circles list / explore** (public circles, filters).
3. **Create circle** (form with a plain-language summary of terms: "6 people, $5 each week, someone gets $30 every week, you lock a $5 deposit").
4. **Circle detail**: ring visual of members, current cycle, pot progress, who has paid, who receives, countdown, contribute button, activity feed.
5. **My circles + reputation profile**: score, history chart, badges, per-circle record.
6. **Join via link** (deep link with terms preview).

States to design explicitly: wallet not connected, wrong network, insufficient balance, approval pending, tx pending / confirmed / failed, circle full, circle cancelled, empty lists.

---

## 7. Repository layout

```
ajo/
├─ DESIGN.md                  # from the template, filled for this project
├─ contracts/                 # Foundry
│  ├─ src/ (AjoFactory, AjoCircle, ReputationRegistry, MockUSD)
│  ├─ test/
│  └─ script/ (Deploy, SeedDemo)
├─ apps/
│  ├─ web/                    # Next.js (landing + app)
│  └─ keeper/                 # settle + reminders
├─ packages/
│  └─ abi/                    # generated ABIs and addresses per chain
└─ docs/ (SPEC.md, ARCHITECTURE.md, DEMO.md, SUBMISSION.md)
```

---

## 8. Timeline (today Oct 2, deadline Oct 13)

Tight on purpose. The Walrus "Relay" entry competes for the same days, so protect the schedule.

| Day | Date | Goal | Exit check |
|---|---|---|---|
| 1 | Oct 2 | Register, read rules, resolve section 0, repo scaffold, DESIGN.md filled | Rules answered, repo pushed |
| 2 | Oct 3 | `AjoCircle` + `ReputationRegistry` core, happy-path tests | Happy path test green |
| 3 | Oct 4 | Defaults, cancel, order modes, fuzz tests | All unit tests green |
| 4 | Oct 5 | Factory, deploy scripts, deploy to Monad test environment | Verified contracts live |
| 5 | Oct 6 | Web app: wallet, create, join, circle detail | Create + join works on deployed contracts |
| 6 | Oct 7 | Contribute, settle, reputation profile, keeper | Full cycle works end to end |
| 7 | Oct 8 | Landing page (kit Layers 0 to 2) | Page reviewed on mobile + desktop |
| 8 | Oct 9 | Seed demo circles, polish, empty / error states, landing Layers 4 to 5 | Quality floor checklist passes |
| 9 | Oct 10 | Stretch: credit pool OR bot, only if everything above is stable | Feature flag off if not ready |
| 10 | Oct 11 | Demo video, README, architecture doc, submission text | Draft submission complete |
| 11 | Oct 12 | Buffer, bug fixes, 3 real testers run a circle | Feedback captured |
| 12 | Oct 13 | Submit early in the day | Submitted |

Cut order if behind: stretch features, then indexer, then bot, then reputation-ordered mode (fall back to join order).

---

## 9. Landing page brief (for LANDING_PAGE_PROMPT.md, Layer 0 input)

- **Primary action:** "Start a circle" (secondary: "See how it works").
- **Audience:** young urban earners and small traders who already know ajo or esusu, plus hackathon judges who need the idea in five seconds.
- **Memorable element (proposal):** a live ring of member avatars where the pot visibly passes to the next recipient. It comes straight from the subject and doubles as the product's core visual.
- **Sections:** hero with the ring, "how a circle works" (a true sequence, so numbering is justified), the reputation score explained, trust and safety (what the contract does and does not do, including the honest limits), built-on-Monad credibility, final call to action, footer with repo and demo video.
- **Constraints:** no dark or grey backgrounds anywhere. Light, chromatic surfaces only. Avoid cream + terracotta and purple-gradient defaults. Palette and fonts to be chosen in Layer 0 from this product's world and from the two reference sites once their specifics are captured in DESIGN.md.
- **Copy rules:** plain words ("Save together. Get paid in turn."), concrete numbers ("6 people, $5 a week, $30 every week"), no crypto jargon above the fold.

---

## 10. Demo and submission

**Demo script (about 2.5 minutes).**
1. Problem in one sentence (organizer ran off with the pot).
2. Create a 5-person circle live, $5 per cycle, short period for the demo.
3. Four seeded wallets join; ring fills; circle starts.
4. Everyone contributes; settlement fires; payout hits instantly. Show the transaction time.
5. One member misses; deposit covers it; score drops visibly.
6. Show a reputation profile and what it unlocks (credit line if built, otherwise state it as next).
7. Close with "why this is real": runs on Monad, open contracts, real testers.

**Submission checklist.** Public repo with README and architecture diagram; deployed + verified contract addresses; demo video; landing page URL; track selection; short written pitch with honest limits; team info. Confirm the exact format against the rules (section 0, item 5).

**Evidence of real use.** Aim for 3 real people completing at least one short-period circle before submission. A real usage log is a stronger signal than a polished slide.

---

## 11. Open decisions for you

1. Stablecoin: use the real one on Monad (once confirmed) or the mock for the demo?
2. Stretch choice if time allows: credit pool or Telegram/WhatsApp bot?
3. Team: solo, or do you want to bring someone in for contracts or design?
4. Name: keep "Ajo", or something more distinctive for the brand?
