// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {console2} from "forge-std/console2.sol";
import {Base} from "./Base.t.sol";
import {AjoCircle} from "../src/AjoCircle.sol";

interface MockUSDLike {
    function balanceOf(address) external view returns (uint256);
}

contract CircleHandler is Base {
    AjoCircle public circle;
    uint8 public n;
    uint256 public settles;

    function usdToken() external view returns (MockUSDLike) {
        return MockUSDLike(address(usd));
    }

    function init() external {
        // initialise Base state inside the handler so it owns the actors
        setUp();
        n = 6;
        circle = _create(n, AjoCircle.OrderMode.JoinOrder, 1);
        _fill(circle, n);
    }

    function pay(uint8 who) external {
        vm.prank(users[who % n]);
        try circle.contribute() {} catch {}
    }

    function settle() external {
        try circle.settleCycle() {
            settles++;
        } catch {}
    }

    function warp(uint32 dt) external {
        vm.warp(block.timestamp + bound(dt, 1, 2 days));
    }

    function claim(uint8 who) external {
        vm.prank(users[who % n]);
        try circle.claimRefund() {} catch {}
        vm.prank(users[who % n]);
        try circle.withdraw() {} catch {}
    }
}

contract AjoInvariantTest is StdInvariant, Base {
    CircleHandler h;

    function setUp() public override {
        h = new CircleHandler();
        h.init();
        targetContract(address(h));
        bytes4[] memory sels = new bytes4[](4);
        sels[0] = CircleHandler.pay.selector;
        sels[1] = CircleHandler.settle.selector;
        sels[2] = CircleHandler.warp.selector;
        sels[3] = CircleHandler.claim.selector;
        targetSelector(FuzzSelector({addr: address(h), selectors: sels}));
    }

    function afterInvariant() public view {
        console2.log("settles reached:", h.settles(), "settled cycles:", h.circle().settledCycles());
    }

    function invariant_balanceMatchesAccounting() public view {
        AjoCircle c = h.circle();
        assertEq(
            h.usdToken().balanceOf(address(c)),
            c.totalDeposits() + c.heldContributions() + c.totalClaimable()
        );
    }

    function invariant_settledNeverExceedsMembers() public view {
        assertLe(h.circle().settledCycles(), h.n());
    }

    function invariant_paidCountMatchesMembers() public view {
        assertLe(h.circle().paidThisCycle(), h.n());
    }
}
