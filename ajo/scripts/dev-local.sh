#!/usr/bin/env bash
# One command local demo: start anvil, deploy contracts, seed demo circles.
#   FORGE_PROFILE=sandbox ./scripts/dev-local.sh      (offline sandbox with a local solc)
set -euo pipefail
cd "$(dirname "$0")/.."

ANVIL=${ANVIL:-anvil}
FORGE=${FORGE:-forge}
PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80   # anvil account 0, local only

if ! curl -s -o /dev/null -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' http://127.0.0.1:8545; then
  echo "starting anvil on :8545"
  nohup setsid "$ANVIL" --port 8545 > /tmp/anvil.log 2>&1 &
  for _ in $(seq 1 20); do
    curl -s -o /dev/null -X POST -H 'content-type: application/json' \
      --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' http://127.0.0.1:8545 && break
    sleep 0.5
  done
fi

(cd contracts && PRIVATE_KEY=$PK "$FORGE" script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast >/tmp/deploy.log 2>&1) \
  || { cat /tmp/deploy.log; exit 1; }
node scripts/export-abi.mjs
npx tsx scripts/seed-local.ts
