# Architecture

```
            ┌────────────────────────── browser ──────────────────────────┐
            │ Next.js app (wagmi + viem)  ── JSON-RPC batches ──┐          │
            └──────────────┬──────────────────────────────────┬─┘          │
                           │ tx (wallet)                      │ reads      │
                  ┌────────▼─────────┐                        │
                  │   AjoFactory     │ clones ┐               │
                  └───┬──────────┬───┘        │               │
         registers    │          │            ▼               │
        writers       │   ┌──────▼───────┐  AjoCircle ×N ◄─────┘
                      │   │ MockUSD /    │  (deposits, contributions, cycles)
                      │   │ stablecoin   │        │ record(outcome)
                      │   └──────────────┘        ▼
                      └──────────────►  ReputationRegistry  ◄── record() ── CreditPool
                                                  ▲
        keeper (settle / cancel / write-off / remind) ──► calls anyone-can-call functions
```

## Contracts

| Contract | Notes |
|---|---|
| `AjoFactory` | Deploys EIP-1167 clones of one `AjoCircle` implementation, whitelists tokens, indexes circles by organizer and by member so the UI needs no indexer. Forces `organizer = msg.sender`. |
| `AjoCircle` | State machine `Open → Active → Completed` or `Cancelled`. Pull-in via `join` and `contribute`; payout via `settleCycle`. Payouts use a low-level token transfer that falls back to `claimable` (pull) if the token refuses, so one blocked recipient cannot freeze a circle. `nonReentrant` on every state-changing function. |
| `ReputationRegistry` | No token, no transfer. Writers: circles (registered by the factory) and the credit pool (set by the owner). Score constants are public and in one file. |
| `CreditPool` | Share-based lender accounting with virtual-share offset; borrower limit `(score - minScore) * creditPerPoint`; flat fee; anyone can `markDefault` after due + grace. Policy changes are owner-only and bounded (`MAX_FEE_BPS`). |
| `MockUSD` | Testnet only. 6 decimals, public faucet. |

### Cycle timing

Cycle `k` window: `[currentCycleStart, currentCycleStart + period]`, then a grace period in which payment counts as late.
`settleCycle` is allowed when every member has paid, or after `end + grace`. After settling, the next cycle starts at
`max(scheduled, now)`: an early settlement does not pull the next cycle forward, and a late one does not penalise the
next cycle's payers.

### Miss handling

1. Deposit covers the missed contribution (`Covered`), score `-60`.
2. No deposit left: the member is `Missed`, flagged as defaulted, score `-200`, and **forfeits their own payout**.
   If the recipient of that cycle is a defaulter, nobody is paid that cycle: contributors are refunded and deposit
   coverage is restored.

## Web app

Routes: `/` landing, `/circles`, `/circles/new`, `/circles/[address]`, `/record/[[...address]]`, `/credit`.
Reads go through `useQuery` with 5 to 15 second polling. Writes go through `useTx`, which simulates first (so a revert
shows a plain-language reason from `lib/errors.ts`), sends, waits for the receipt, and refreshes. Chain time comes from
the latest block, not the browser clock, so countdowns are right on any chain.

## Keeper

`src/plan.ts` is pure and unit-tested. `src/index.ts` is the thin I/O loop. It only calls functions anyone can call,
so the product does not depend on it; a human can settle from the UI.
