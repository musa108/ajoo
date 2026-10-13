// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.t.sol";
import {AjoCircle} from "../src/AjoCircle.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";

contract AjoCircleTest is Base {
    // ------------------------------------------------------------ creation / join

    function test_create_setsOrganizerFromCaller() public {
        AjoCircle c = _create(5, AjoCircle.OrderMode.JoinOrder, 1);
        assertEq(c.organizer(), organizer);
        assertEq(c.maxMembers(), 5);
        assertEq(c.weight(), 2); // $5 -> x1
        assertTrue(factory.isCircle(address(c)));
        assertEq(factory.circleCount(), 1);
        assertTrue(reg.isWriter(address(c)));
    }

    function test_create_revertsForUnknownToken() public {
        AjoCircle.Params memory p = _params(5, AjoCircle.OrderMode.JoinOrder, 1, 0);
        p.token = makeAddr("other");
        vm.prank(organizer);
        vm.expectRevert(bytes4(keccak256("TokenNotAllowed()")));
        factory.createCircle(p);
    }

    function test_create_revertsOnBadParams() public {
        AjoCircle.Params memory p = _params(1, AjoCircle.OrderMode.JoinOrder, 1, 0);
        vm.prank(organizer);
        vm.expectRevert(AjoCircle.BadParams.selector);
        factory.createCircle(p);

        p = _params(5, AjoCircle.OrderMode.JoinOrder, 1, 0);
        p.period = 10;
        vm.prank(organizer);
        vm.expectRevert(AjoCircle.BadParams.selector);
        factory.createCircle(p);

        p = _params(5, AjoCircle.OrderMode.JoinOrder, 1, 0);
        p.name = "";
        vm.prank(organizer);
        vm.expectRevert(AjoCircle.BadParams.selector);
        factory.createCircle(p);
    }

    function test_join_locksDepositAndStartsWhenFull() public {
        AjoCircle c = _create(3, AjoCircle.OrderMode.JoinOrder, 1);
        vm.prank(users[0]);
        c.join();
        assertEq(usd.balanceOf(address(c)), C);
        assertEq(uint8(c.state()), uint8(AjoCircle.State.Open));
        vm.prank(users[1]);
        c.join();
        vm.prank(users[2]);
        c.join();
        assertEq(uint8(c.state()), uint8(AjoCircle.State.Active));
        assertEq(c.startTime(), block.timestamp);
        assertEq(c.recipientOf(0), users[0]);
        assertEq(c.recipientOf(2), users[2]);
        assertEq(factory.circlesOfMember(users[1]).length, 1);
    }

    function test_join_reverts() public {
        AjoCircle c = _create(3, AjoCircle.OrderMode.JoinOrder, 1);
        vm.prank(users[0]);
        c.join();
        vm.prank(users[0]);
        vm.expectRevert(AjoCircle.AlreadyMember.selector);
        c.join();

        _fill(c, 0);
        vm.prank(users[1]);
        c.join();
        vm.prank(users[2]);
        c.join();
        vm.prank(users[3]);
        vm.expectRevert(AjoCircle.NotOpen.selector);
        c.join();
    }

    function test_join_afterDeadlineReverts() public {
        AjoCircle c = _create(3, AjoCircle.OrderMode.JoinOrder, 1);
        vm.warp(block.timestamp + 8 days);
        vm.prank(users[0]);
        vm.expectRevert(AjoCircle.JoinClosed.selector);
        c.join();
    }

    function test_join_minScoreGate() public {
        vm.prank(organizer);
        AjoCircle c = AjoCircle(factory.createCircle(_params(3, AjoCircle.OrderMode.JoinOrder, 1, 50)));
        vm.prank(users[0]);
        usd.approve(address(c), type(uint256).max);
        vm.prank(users[0]);
        vm.expectRevert(AjoCircle.ScoreTooLow.selector);
        c.join();
    }

    function test_leaveBeforeStart_refundsAndPreservesJoinOrder() public {
        AjoCircle c = _create(3, AjoCircle.OrderMode.JoinOrder, 1);
        vm.prank(users[0]);
        c.join();
        vm.prank(users[1]);
        c.join();
        uint256 before = usd.balanceOf(users[0]);
        vm.prank(users[0]);
        c.leave();
        assertEq(usd.balanceOf(users[0]), before + C);
        address[] memory m = c.members();
        assertEq(m.length, 1);
        assertEq(m[0], users[1]);
        assertEq(c.totalDeposits(), C);
    }

    function test_cancel_organizerAnytime_othersAfterDeadline() public {
        AjoCircle c = _create(3, AjoCircle.OrderMode.JoinOrder, 1);
        vm.prank(users[0]);
        c.join();

        vm.prank(users[5]);
        vm.expectRevert(AjoCircle.NotAllowed.selector);
        c.cancel();

        vm.warp(block.timestamp + 8 days);
        vm.prank(users[5]);
        c.cancel();
        assertEq(uint8(c.state()), uint8(AjoCircle.State.Cancelled));

        uint256 before = usd.balanceOf(users[0]);
        vm.prank(users[0]);
        c.claimRefund();
        assertEq(usd.balanceOf(users[0]), before + C);
        assertEq(usd.balanceOf(address(c)), 0);
    }

    // ------------------------------------------------------------ happy path

    function test_happyPath_fullCircle() public {
        uint8 n = 5;
        AjoCircle c = _create(n, AjoCircle.OrderMode.JoinOrder, 1);
        _fill(c, n);

        for (uint8 cycle; cycle < n; ++cycle) {
            _payAll(c, n);
            assertTrue(c.canSettle());
            uint256 before = usd.balanceOf(users[cycle]);
            c.settleCycle();
            assertEq(usd.balanceOf(users[cycle]), before + uint256(C) * n, "recipient got the pot");
            if (cycle + 1 < n) vm.warp(block.timestamp + PERIOD);
        }
        assertEq(uint8(c.state()), uint8(AjoCircle.State.Completed));

        // everyone refunds their deposit, no one is out of pocket beyond the loop
        for (uint256 i; i < n; ++i) {
            vm.prank(users[i]);
            c.claimRefund();
            assertEq(usd.balanceOf(users[i]), 10_000e6, "net zero for a clean circle");
            ReputationRegistry.Stats memory s = reg.statsOf(users[i]);
            assertEq(s.onTime, 5);
            assertEq(s.circlesCompleted, 1);
            assertEq(s.score, 5 * 10 + 50);
        }
        assertEq(usd.balanceOf(address(c)), 0);
    }

    function test_earlySettle_doesNotShiftSchedule() public {
        AjoCircle c = _create(3, AjoCircle.OrderMode.JoinOrder, 1);
        _fill(c, 3);
        uint64 start = c.currentCycleStart();
        _payAll(c, 3);
        c.settleCycle();
        assertEq(c.currentCycleStart(), start + PERIOD, "next cycle starts on schedule");

        vm.prank(users[0]);
        vm.expectRevert(AjoCircle.CycleNotStarted.selector);
        c.contribute();
    }

    function test_settleBeforeAllPaid_reverts() public {
        AjoCircle c = _create(3, AjoCircle.OrderMode.JoinOrder, 1);
        _fill(c, 3);
        vm.prank(users[0]);
        c.contribute();
        vm.expectRevert(AjoCircle.CannotSettleYet.selector);
        c.settleCycle();

        vm.warp(block.timestamp + PERIOD + GRACE); // still inside grace boundary
        vm.expectRevert(AjoCircle.CannotSettleYet.selector);
        c.settleCycle();
    }

    function test_contribute_rules() public {
        AjoCircle c = _create(3, AjoCircle.OrderMode.JoinOrder, 1);
        vm.prank(users[0]);
        vm.expectRevert(AjoCircle.NotActive.selector);
        c.contribute();

        _fill(c, 3);
        vm.prank(users[0]);
        c.contribute();
        vm.prank(users[0]);
        vm.expectRevert(AjoCircle.AlreadyPaid.selector);
        c.contribute();

        vm.prank(users[9]);
        vm.expectRevert(AjoCircle.NotMember.selector);
        c.contribute();

        vm.warp(block.timestamp + PERIOD + GRACE + 1);
        vm.prank(users[1]);
        vm.expectRevert(AjoCircle.CycleClosed.selector);
        c.contribute();
    }

    // ------------------------------------------------------------ late / default

    function test_lateContributionInsideGrace() public {
        AjoCircle c = _create(3, AjoCircle.OrderMode.JoinOrder, 1);
        _fill(c, 3);
        vm.prank(users[0]);
        c.contribute();
        vm.prank(users[1]);
        c.contribute();
        vm.warp(block.timestamp + PERIOD + 1);
        vm.prank(users[2]);
        c.contribute();
        c.settleCycle();
        assertEq(uint8(c.statusOf(0, users[2])), uint8(AjoCircle.CycleStatus.Late));
        ReputationRegistry.Stats memory s = reg.statsOf(users[2]);
        assertEq(s.late, 1);
        assertEq(s.score, 0); // -5 floors at 0
        // late settle shifts next cycle start to now, not earlier
        assertEq(c.currentCycleStart(), block.timestamp);
    }

    function test_defaultCoveredByDeposit_recipientStillPaid() public {
        uint8 n = 4;
        AjoCircle c = _create(n, AjoCircle.OrderMode.JoinOrder, 1);
        _fill(c, n);
        // user3 never pays in cycle 0
        for (uint256 i; i < 3; ++i) {
            vm.prank(users[i]);
            c.contribute();
        }
        vm.warp(block.timestamp + PERIOD + GRACE + 1);
        uint256 before = usd.balanceOf(users[0]);
        c.settleCycle();

        assertEq(uint8(c.statusOf(0, users[3])), uint8(AjoCircle.CycleStatus.Covered));
        assertEq(usd.balanceOf(users[0]), before + uint256(C) * n, "pot is whole thanks to the deposit");
        assertEq(c.memberInfo(users[3]).deposit, 0);
        assertFalse(c.memberInfo(users[3]).defaulted);
        assertEq(reg.statsOf(users[3]).defaultsCovered, 1);
    }

    function test_uncoveredDefault_flagsMember_andShrinksPot() public {
        uint8 n = 4;
        AjoCircle c = _create(n, AjoCircle.OrderMode.JoinOrder, 1);
        _fill(c, n);

        // cycle 0: user3 misses, deposit covers
        for (uint256 i; i < 3; ++i) {
            vm.prank(users[i]);
            c.contribute();
        }
        vm.warp(block.timestamp + PERIOD + GRACE + 1);
        c.settleCycle();

        // cycle 1: user3 misses again with no deposit left
        for (uint256 i; i < 3; ++i) {
            vm.prank(users[i]);
            c.contribute();
        }
        vm.warp(block.timestamp + PERIOD + GRACE + 1);
        uint256 before = usd.balanceOf(users[1]);
        c.settleCycle();
        assertEq(uint8(c.statusOf(1, users[3])), uint8(AjoCircle.CycleStatus.Missed));
        assertTrue(c.memberInfo(users[3]).defaulted);
        assertEq(usd.balanceOf(users[1]), before + uint256(C) * 3, "pot is one contribution short");
        assertEq(reg.statsOf(users[3]).defaultsUncovered, 1);
    }

    function test_defaultedRecipient_forfeits_contributorsRefunded() public {
        uint8 n = 3;
        // reputation order would not matter here: join order puts users[2] last, so make the defaulter first
        AjoCircle c = _create(n, AjoCircle.OrderMode.JoinOrder, 0); // no deposit at all
        _fill(c, n);

        // cycle 0 recipient is users[0]; users[0] does not pay -> uncovered default, forfeits its own payout
        vm.prank(users[1]);
        c.contribute();
        vm.prank(users[2]);
        c.contribute();
        vm.warp(block.timestamp + PERIOD + GRACE + 1);

        uint256 b1 = usd.balanceOf(users[1]);
        uint256 b2 = usd.balanceOf(users[2]);
        uint256 b0 = usd.balanceOf(users[0]);
        c.settleCycle();

        assertEq(usd.balanceOf(users[1]), b1 + C, "refunded");
        assertEq(usd.balanceOf(users[2]), b2 + C, "refunded");
        assertEq(usd.balanceOf(users[0]), b0, "defaulter gets nothing");
        assertEq(usd.balanceOf(address(c)), 0);
    }

    function test_completedWithDefault_noCompletionBonus() public {
        uint8 n = 2;
        AjoCircle c = _create(n, AjoCircle.OrderMode.JoinOrder, 1);
        _fill(c, n);
        // cycle 0: user1 misses (covered)
        vm.prank(users[0]);
        c.contribute();
        vm.warp(block.timestamp + PERIOD + GRACE + 1);
        c.settleCycle();
        // cycle 1: both pay
        _payAll(c, n);
        c.settleCycle();
        assertEq(uint8(c.state()), uint8(AjoCircle.State.Completed));
        assertEq(reg.statsOf(users[0]).circlesCompleted, 1);
        assertEq(reg.statsOf(users[1]).circlesCompleted, 0);
    }

    // ------------------------------------------------------------ ordering

    function test_reputationOrder_highestScoreFirst_tiesByJoin() public {
        // build reputation: users[3] completes a short circle with users[4], users[5]
        AjoCircle warm = _create(3, AjoCircle.OrderMode.JoinOrder, 1);
        for (uint256 i = 3; i < 6; ++i) {
            vm.prank(users[i]);
            usd.approve(address(warm), type(uint256).max);
        }
        vm.prank(users[3]);
        warm.join();
        vm.prank(users[4]);
        warm.join();
        vm.prank(users[5]);
        warm.join();
        for (uint8 k; k < 3; ++k) {
            vm.prank(users[3]);
            warm.contribute();
            vm.prank(users[4]);
            warm.contribute();
            vm.prank(users[5]);
            warm.contribute();
            warm.settleCycle();
            vm.warp(block.timestamp + PERIOD);
        }
        assertEq(reg.scoreOf(users[3]), 80);

        // new circle ordered by reputation: join order 0,1,2,3 -> users[3] should be first, others keep join order
        AjoCircle c = _create(4, AjoCircle.OrderMode.ReputationOrder, 1);
        _fill(c, 4);
        assertEq(c.recipientOf(0), users[3]);
        assertEq(c.recipientOf(1), users[0]);
        assertEq(c.recipientOf(2), users[1]);
        assertEq(c.recipientOf(3), users[2]);
    }

    // ------------------------------------------------------------ ledger / views

    function test_ledgerMatrix() public {
        AjoCircle c = _create(3, AjoCircle.OrderMode.JoinOrder, 1);
        uint8[][] memory empty = c.ledger();
        assertEq(empty.length, 0);
        _fill(c, 3);
        vm.prank(users[0]);
        c.contribute();
        uint8[][] memory l = c.ledger();
        assertEq(l.length, 3);
        assertEq(l[0].length, 3);
        assertEq(l[0][0], uint8(AjoCircle.CycleStatus.OnTime));
        assertEq(l[1][0], uint8(AjoCircle.CycleStatus.None));
    }

    function test_factoryPaging_newestFirst() public {
        for (uint256 i; i < 3; ++i) {
            vm.prank(organizer);
            factory.createCircle(_params(3, AjoCircle.OrderMode.JoinOrder, 1, 0));
        }
        address[] memory page = factory.getCircles(0, 2);
        assertEq(page.length, 2);
        assertEq(page[0], factory.getCircles(0, 10)[0]);
        assertEq(factory.getCircles(2, 10).length, 1);
        assertEq(factory.getCircles(5, 10).length, 0);
        assertEq(factory.circlesOfOrganizer(organizer).length, 3);
    }

    // ------------------------------------------------------------ security

    function test_registry_onlyWritersCanRecord() public {
        vm.expectRevert(ReputationRegistry.NotWriter.selector);
        reg.record(users[0], ReputationRegistryOutcome.onTime(), 2, 1);
        vm.expectRevert(ReputationRegistry.NotRegistrar.selector);
        reg.registerWriter(users[0]);
    }

    function test_hooks_onlyCirclesCanNotifyFactory() public {
        vm.expectRevert(bytes4(keccak256("NotCircle()")));
        factory.onMemberJoined(users[0]);
    }

    function test_circle_cannotBeReinitialised() public {
        AjoCircle c = _create(3, AjoCircle.OrderMode.JoinOrder, 1);
        AjoCircle.Params memory p = _params(3, AjoCircle.OrderMode.JoinOrder, 1, 0);
        vm.expectRevert();
        c.initialize(p, address(reg), address(factory));
        AjoCircle impl = AjoCircle(factory.implementation());
        vm.expectRevert();
        impl.initialize(p, address(reg), address(factory));
    }

    function test_claimRefund_notBeforeEnd() public {
        AjoCircle c = _create(3, AjoCircle.OrderMode.JoinOrder, 1);
        _fill(c, 3);
        vm.prank(users[0]);
        vm.expectRevert(AjoCircle.NotAllowed.selector);
        c.claimRefund();
    }
}

import {Outcome} from "../src/interfaces/IReputation.sol";

library ReputationRegistryOutcome {
    function onTime() internal pure returns (Outcome) {
        return Outcome.OnTime;
    }
}
