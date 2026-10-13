#!/usr/bin/env bash
# Fetches the two Solidity dependencies pinned to the versions the contracts were tested with.
set -euo pipefail
cd "$(dirname "$0")/../contracts"
mkdir -p lib
[ -d lib/forge-std ] || git clone --depth 1 https://github.com/foundry-rs/forge-std lib/forge-std
[ -d lib/openzeppelin-contracts ] || git clone --depth 1 --branch v5.1.0 https://github.com/OpenZeppelin/openzeppelin-contracts lib/openzeppelin-contracts
echo "dependencies ready"
