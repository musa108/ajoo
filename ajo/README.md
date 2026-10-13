# Ajo

The savings circle you already know (ajo, esusu, susu, tanda), with the pot held by a contract instead of a person.
Members pay a fixed amount each cycle, one member takes the whole pot, and every on-time payment builds an on-chain
reputation that unlocks small loans.

Built for **Monad Metropolis**, onchain finance track.

> **Status: working prototype.** Contracts, keeper, and web app run end to end on a local chain and are covered by
> tests (below). It has **not** been deployed to Monad from the build environment, the contracts are **not audited**,
> and it moves test dollars only. See [Known gaps](#known-gaps) before you rely on anything.

## Repo layout

```
contracts/      Foundry project: AjoFactory, AjoCircle, ReputationRegistry, CreditPool, MockUSD, tests, deploy script
apps/web/       Next.js 15 app: landing page, circles, create, ledger, record, credit
apps/keeper/    Node service: settles cycles, cancels unfilled circles, writes off overdue loans, sends reminders
packages/abi/   ABIs and deployment addresses generated from Foundry output (shared by web, keeper, scripts)
scripts/        dev-local.sh (chain + deploy + seed), seed-local.ts, export-abi.mjs, e2e_browser.py
docs/           SPEC, ARCHITECTURE, DEMO script, SUBMISSION checklist, LANDING_PAGE_PROMPT
DESIGN.md       The design source of truth (read before touching UI)
```

## Quickstart (local, about two minutes)

Prerequisites: [Foundry](https://book.getfoundry.sh/getting-started/installation), Node 20+.

```bash
npm install
./scripts/install-deps.sh            # forge-std + OpenZeppelin v5.1.0 into contracts/lib
./scripts/dev-local.sh               # starts anvil, deploys, seeds three demo circles + a credit pool
npm run dev:web                      # http://localhost:3000
```

Connect any browser wallet to `http://127.0.0.1:8545` (chain id 31337) and import an anvil dev key
(`test test test test test test test test test test test junk`, local only). Use **Get 1,000 test dollars** in the
header, then join, pay, and settle. The seed gives account 1 a score of 500 so the credit flow can be shown.

Run the keeper against it: `KEEPER_PRIVATE_KEY=<anvil key> npm run keeper` (add `-- --once` for one sweep, `DRY_RUN=1` to only log).

## Tests

| Layer | Command | What it covers |
|---|---|---|
| Contracts | `cd contracts && forge test` | 40 tests: unit (all paths and reverts), fuzz (token conservation across random circle sizes, deposits and miss patterns), invariants (balance equals deposits + held + claimable), credit pool math |
| Keeper | `npm test -w apps/keeper` | 9 tests on the pure decision logic (when to settle, cancel, remind) |
| Browser | `python3 scripts/e2e_browser.py` | 20 checks in real Chromium against the local chain: create, join, pay, settle, ledger, cancel dialog, record, borrow, repay, responsive overflow, light background. Uses a small wallet shim backed by anvil's unlocked accounts. Needs a fresh chain each run (`./scripts/dev-local.sh`) |

## Deploy to Monad testnet

1. `cp .env.example apps/web/.env.local` and **verify** the chain id, RPC, explorer, and native symbol against Monad's docs. They are not confirmed here.
2. Fund a deployer. Then:
   ```bash
   cd contracts
   PRIVATE_KEY=0x... forge script script/Deploy.s.sol --rpc-url $RPC --broadcast
   cd .. && npm run abi             # bakes contracts/deployments/<chainId>.json into packages/abi
   ```
   Leave `TOKEN` unset to deploy `MockUSD` (testnet only). To use a real stablecoin, set `TOKEN=0x...`; the credit pool assumes 6 decimals.
3. Check `evm_version` in `contracts/foundry.toml` (set to `cancun`) is supported by Monad.
4. Web: deploy `apps/web` (Vercel: root directory `apps/web`, install command `cd ../.. && npm install`). Set the `NEXT_PUBLIC_*` variables.
5. Keeper: run `apps/keeper` anywhere that can stay up (Render, Railway, a VPS) with `KEEPER_PRIVATE_KEY` for a dedicated low-balance wallet.
6. Add `NEXT_PUBLIC_REPO_URL` and `NEXT_PUBLIC_DEMO_VIDEO_URL` so the landing footer links them.

The app reads through plain JSON-RPC batches, so it does not depend on a Multicall3 deployment.

## How it works

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). In short: a factory clones `AjoCircle`; each circle holds deposits and
contributions; `settleCycle` (callable by anyone) pays the pot, covers misses from deposits, and reports every outcome to
`ReputationRegistry`; `CreditPool` lends against that score.

## Known gaps

Read these. They are real.

- **Not audited.** Tested, fuzzed, and invariant-checked, but nobody independent has reviewed the contracts.
- **Deposits do not fully cover early defaulters.** A deposit of one payment cannot cover the (n-1) payments a first-slot member still owes. `Highest reputation first` ordering and a minimum score reduce the risk; they do not remove it. A defaulter forfeits their own turn, and contributors of that cycle are refunded, but later recipients can be paid a smaller pot.
- **Reputation can be farmed** with several wallets in friendly circles. Larger circles weigh more; real protection needs identity or attestation, which is not built.
- **Unsecured credit can lose lenders' money.** Limits grow with score and are owner-adjustable within hard caps.
- **No fiat on/off-ramp.** Payments are stablecoin only. On testnet they are test dollars.
- **Not a regulated service.** Pooled savings and lending are regulated activities in many jurisdictions, including Nigeria. This is a prototype.
- **No activity feed or indexer.** The UI shows current state and the ledger; it does not list historical events.
- **Wallets:** injected browser wallets only. No embedded wallet or social login yet.
- **No Telegram/WhatsApp bot.** The keeper sends reminders to a console and an optional webhook, addressed by wallet, not by contact.
- **The browser tests used a wallet shim**, not MetaMask itself, and ran on one machine. No real-device or Lighthouse run yet.
- **Reference-site match.** The two reference sites (drocsid.app, normandyos.vercel.app) could not be opened from the build environment, so the visual style follows `DESIGN.md`, not a copy of them.
- **Monad specifics unverified:** chain id, RPC, explorer, EVM version, token availability, and the hackathon's own rules (eligibility, deployment, new-code requirement).
- **Demo seed writes fake reputation** for one wallet (owner-only, local, mock token only) so the credit flow can be shown. It is labelled in `seed-local.ts` and refuses to run elsewhere.

## Design

`DESIGN.md` holds the tokens and rules. Hard rule: **no dark or grey backgrounds**, including dialog scrims.
`docs/LANDING_PAGE_PROMPT.md` is the layered prompt kit for building pages in this style.
