// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.t.sol";
import {CreditPool} from "../src/CreditPool.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {Outcome} from "../src/interfaces/IReputation.sol";

contract CreditPoolTest is Base {
    address lender;
    address borrower;

    function setUp() public override {
        super.setUp();
        lender = users[0];
        borrower = users[1];
        vm.prank(admin);
        reg.setWriter(admin, true);

        vm.startPrank(lender);
        usd.approve(address(pool), type(uint256).max);
        pool.supply(1_000e6);
        vm.stopPrank();
        vm.prank(borrower);
        usd.approve(address(pool), type(uint256).max);
    }

    function _giveScore(address who, uint256 onTimeCount) internal {
        vm.startPrank(admin);
        for (uint256 i; i < onTimeCount; ++i) {
            reg.record(who, Outcome.OnTime, 4, 1); // +20 each
        }
        vm.stopPrank();
    }

    function test_borrow_belowMinScore_reverts() public {
        vm.prank(borrower);
        vm.expectRevert(CreditPool.ScoreTooLow.selector);
        pool.borrow(1e6);
    }

    function test_creditLimit_growsWithScore() public {
        assertEq(pool.creditLimit(borrower), 0);
        _giveScore(borrower, 25); // 500
        assertEq(reg.scoreOf(borrower), 500);
        assertEq(pool.creditLimit(borrower), 100 * 500_000); // 100 pts above 400, $0.50 each = $50
        _giveScore(borrower, 25); // 1000 cap
        assertEq(reg.scoreOf(borrower), 1000);
        assertEq(pool.creditLimit(borrower), 600 * 500_000);
    }

    function test_borrow_overLimit_reverts() public {
        _giveScore(borrower, 25);
        vm.prank(borrower);
        vm.expectRevert(CreditPool.OverLimit.selector);
        pool.borrow(51e6);
    }

    function test_borrowAndRepay_lenderEarnsFee_scoreRises() public {
        _giveScore(borrower, 25);
        uint256 before = reg.scoreOf(borrower);
        vm.prank(borrower);
        pool.borrow(50e6);
        assertEq(pool.owed(borrower), 50e6 + 1.5e6); // 3% fee
        assertEq(pool.totalLoaned(), 50e6);

        vm.prank(borrower);
        pool.repay(100e6); // capped at what is owed
        assertEq(pool.owed(borrower), 0);
        assertEq(pool.totalLoaned(), 0);
        assertEq(reg.scoreOf(borrower), before + 25);

        // lender's position grew by the fee
        assertEq(pool.valueOf(lender), 1_000e6 + 1.5e6 - 1); // -1 from virtual-share rounding
    }

    function test_partialRepay_principalFirst() public {
        _giveScore(borrower, 25);
        vm.startPrank(borrower);
        pool.borrow(50e6);
        pool.repay(20e6);
        vm.stopPrank();
        (uint128 p, uint128 f,, bool open) = pool.loans(borrower);
        assertEq(p, 30e6);
        assertEq(f, 1.5e6);
        assertTrue(open);
        assertEq(pool.totalLoaned(), 30e6);
    }

    function test_oneOpenLoanAtATime() public {
        _giveScore(borrower, 25);
        vm.startPrank(borrower);
        pool.borrow(10e6);
        vm.expectRevert(CreditPool.LoanOpen.selector);
        pool.borrow(10e6);
        vm.stopPrank();
    }

    function test_default_writesOff_andSlashesScore() public {
        _giveScore(borrower, 25);
        vm.prank(borrower);
        pool.borrow(50e6);

        vm.expectRevert(CreditPool.NotDefaultable.selector);
        pool.markDefault(borrower);

        vm.warp(block.timestamp + 14 days + 3 days + 1);
        pool.markDefault(borrower);
        assertEq(pool.totalLoaned(), 0);
        assertEq(reg.scoreOf(borrower), 500 - 300);
        assertEq(pool.creditLimit(borrower), 0);
        assertLt(pool.valueOf(lender), 1_000e6, "lender bears the loss");
    }

    function test_withdraw_limitedByIdleLiquidity() public {
        _giveScore(borrower, 25);
        vm.prank(borrower);
        pool.borrow(50e6);
        uint256 shares = pool.sharesOf(lender);
        vm.prank(lender);
        vm.expectRevert(CreditPool.NotLiquid.selector);
        pool.withdraw(shares);

        vm.prank(lender);
        pool.withdraw(shares / 2);
    }

    function test_setPolicy_onlyOwner_andBounded() public {
        vm.expectRevert();
        pool.setPolicy(300, 1, 100, 1 days, 1 days);
        vm.prank(admin);
        vm.expectRevert(CreditPool.BadPolicy.selector);
        pool.setPolicy(300, 1, 5_000, 1 days, 1 days);
        vm.prank(admin);
        pool.setPolicy(300, 1, 100, 1 days, 1 days);
        assertEq(pool.minScore(), 300);
    }

    function testFuzz_shareMathNeverLosesToRounding(uint96 a, uint96 b) public {
        uint256 x = bound(a, 1e6, 500e6);
        uint256 y = bound(b, 1e6, 500e6);
        vm.prank(users[2]);
        usd.approve(address(pool), type(uint256).max);
        vm.prank(users[2]);
        uint256 s1 = pool.supply(x);
        vm.prank(users[3]);
        usd.approve(address(pool), type(uint256).max);
        vm.prank(users[3]);
        uint256 s2 = pool.supply(y);
        uint256 v1 = pool.valueOf(users[2]);
        uint256 v2 = pool.valueOf(users[3]);
        assertLe(v1, x);
        assertLe(v2, y);
        assertGe(v1 + 2, x);
        assertGe(v2 + 2, y);
        assertGt(s1 + s2, 0);
    }
}
