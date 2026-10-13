// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {AjoFactory} from "../src/AjoFactory.sol";
import {AjoCircle} from "../src/AjoCircle.sol";
import {CreditPool} from "../src/CreditPool.sol";

abstract contract Base is Test {
    MockUSD usd;
    ReputationRegistry reg;
    AjoFactory factory;
    CreditPool pool;

    address admin = makeAddr("admin");
    address organizer = makeAddr("organizer");
    address[] users;

    uint128 constant C = 5e6; // $5 per cycle
    uint32 constant PERIOD = 1 days;
    uint32 constant GRACE = 2 hours;

    function setUp() public virtual {
        vm.startPrank(admin);
        usd = new MockUSD();
        reg = new ReputationRegistry(admin);
        factory = new AjoFactory(address(reg), admin);
        reg.setRegistrar(address(factory), true);
        factory.setTokenAllowed(address(usd), true);
        pool = new CreditPool(address(usd), address(reg), admin, 500_000);
        reg.setWriter(address(pool), true);
        vm.stopPrank();

        for (uint256 i; i < 12; ++i) {
            address u = makeAddr(string.concat("user", vm.toString(i)));
            users.push(u);
            usd.mint(u, 10_000e6);
            vm.prank(u);
            usd.approve(address(factory), type(uint256).max);
        }
    }

    function _params(uint8 n, AjoCircle.OrderMode mode, uint8 depMult, uint16 minScore)
        internal
        view
        returns (AjoCircle.Params memory p)
    {
        p = AjoCircle.Params({
            name: "Balogun Market Women",
            token: address(usd),
            contribution: C,
            period: PERIOD,
            grace: GRACE,
            maxMembers: n,
            depositMultiple: depMult,
            orderMode: mode,
            joinDeadline: uint64(block.timestamp + 7 days),
            minScore: minScore,
            organizer: address(0)
        });
    }

    function _create(uint8 n, AjoCircle.OrderMode mode, uint8 depMult) internal returns (AjoCircle c) {
        vm.prank(organizer);
        c = AjoCircle(factory.createCircle(_params(n, mode, depMult, 0)));
        for (uint256 i; i < n; ++i) {
            vm.startPrank(users[i]);
            usd.approve(address(c), type(uint256).max);
            vm.stopPrank();
        }
    }

    function _fill(AjoCircle c, uint8 n) internal {
        for (uint256 i; i < n; ++i) {
            vm.prank(users[i]);
            c.join();
        }
    }

    function _payAll(AjoCircle c, uint8 n) internal {
        for (uint256 i; i < n; ++i) {
            vm.prank(users[i]);
            c.contribute();
        }
    }
}
