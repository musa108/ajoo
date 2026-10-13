// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice TESTNET / DEMO ONLY. A 6-decimal dollar stand-in with a public faucet.
///         Never whitelist this on a production deployment.
contract MockUSD is ERC20 {
    uint256 public constant FAUCET_MAX = 1_000e6;

    constructor() ERC20("Mock USD", "mUSD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function faucet(uint256 amount) external {
        require(amount <= FAUCET_MAX, "faucet: max 1000 mUSD");
        _mint(msg.sender, amount);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
