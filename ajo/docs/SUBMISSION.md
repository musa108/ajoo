# Submission checklist

Confirm every item against the hackathon's actual rules page (it was behind a login when this was written).

## Rules to confirm first
- [ ] Eligible to enter from Nigeria; team size limits
- [ ] Whether new code is required (work started after the start date). `LinkStore` / `Nodara` code was not reused here.
- [ ] Testnet vs mainnet deployment requirement
- [ ] Required submission format: video length, repo, deck, track selection
- [ ] Which stablecoin exists on Monad. If a real one is available, redeploy with `TOKEN=` and re-run the browser checks

## Deliverables
- [ ] Contracts deployed and verified on the explorer (addresses in `contracts/deployments/<chainId>.json`)
- [ ] Web app deployed; landing URL
- [ ] Keeper running during judging
- [ ] Public repo with README, architecture doc, this checklist
- [ ] Demo video (`docs/DEMO.md`)
- [ ] Three real people completed at least one short-period circle. Capture screenshots or transaction links as evidence
- [ ] `NEXT_PUBLIC_REPO_URL` and `NEXT_PUBLIC_DEMO_VIDEO_URL` set

## Written pitch (draft; edit)

**Ajo** puts the rotating savings circle on-chain. Members pay a fixed amount each cycle, one takes the pot, and a
contract, not a person, holds the money. Every on-time payment writes to a public, non-transferable reputation score;
past a threshold the score unlocks small loans from a shared pool, and repayment feeds back into the score.

**Why Monad.** Small, frequent payments only make sense when fees are tiny and settlement is fast. A circle that pays out
the moment the last member contributes is the demo of that.

**Track fit.** Onchain finance: credit priced on onchain history. Ajo builds the history first.

**Honest limits.** Unaudited. A one-payment deposit does not cover a first-slot defaulter's remaining payments. Reputation
farming with multiple wallets is possible. No fiat ramp. Prototype, not a regulated service.
