// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.t.sol";
import {AjoCircle} from "../src/AjoCircle.sol";

contract AjoFuzzTest is Base {
    uint256 constant START_BAL = 10_000e6;

    /// @dev Random circle size, deposit multiple and per-cycle payment patterns. Whatever happens, tokens are
    ///      conserved: nothing is created or destroyed and the circle ends at zero once everyone has withdrawn.
    function testFuzz_conservation(uint8 nRaw, uint8 depRaw, uint256 patternSeed, bool repOrder) public {
        uint8 n = uint8(bound(nRaw, 2, 12));
        uint8 dep = uint8(bound(depRaw, 0, 3));
        AjoCircle c = _create(n, repOrder ? AjoCircle.OrderMode.ReputationOrder : AjoCircle.OrderMode.JoinOrder, dep);
        _fill(c, n);

        for (uint8 cycle; cycle < n; ++cycle) {
            for (uint256 i; i < n; ++i) {
                bool pays = uint256(keccak256(abi.encode(patternSeed, cycle, i))) % 4 != 0; // ~75% pay
                if (pays) {
                    vm.prank(users[i]);
                    c.contribute();
                }
                _assertBalanceIdentity(c);
            }
            if (!c.canSettle()) vm.warp(block.timestamp + PERIOD + GRACE + 1);
            c.settleCycle();
            _assertBalanceIdentity(c);
            if (cycle + 1 < n) vm.warp(block.timestamp + PERIOD);
        }

        assertEq(uint8(c.state()), uint8(AjoCircle.State.Completed));

        for (uint256 i; i < n; ++i) {
            if (c.memberInfo(users[i]).deposit > 0) {
                vm.prank(users[i]);
                c.claimRefund();
            }
            if (c.claimable(users[i]) > 0) {
                vm.prank(users[i]);
                c.withdraw();
            }
        }

        assertEq(usd.balanceOf(address(c)), 0, "circle drained");
        uint256 sum;
        for (uint256 i; i < n; ++i) {
            sum += usd.balanceOf(users[i]);
        }
        assertEq(sum, uint256(n) * START_BAL, "tokens conserved across members");
    }

    function testFuzz_onlyOnePayoutPerMember(uint8 nRaw) public {
        uint8 n = uint8(bound(nRaw, 2, 12));
        AjoCircle c = _create(n, AjoCircle.OrderMode.JoinOrder, 1);
        _fill(c, n);
        address[] memory ord = c.payoutOrder();
        for (uint256 i; i < n; ++i) {
            for (uint256 j = i + 1; j < n; ++j) {
                assertTrue(ord[i] != ord[j]);
            }
        }
    }

    function _assertBalanceIdentity(AjoCircle c) internal view {
        assertEq(
            usd.balanceOf(address(c)),
            c.totalDeposits() + c.heldContributions() + c.totalClaimable(),
            "balance == deposits + held + claimable"
        );
    }
}
