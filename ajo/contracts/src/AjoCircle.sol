// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IReputation, Outcome} from "./interfaces/IReputation.sol";

interface IAjoFactoryHooks {
    function onMemberJoined(address member) external;
}

/// @title AjoCircle
/// @notice One rotating savings circle. Each cycle every member contributes a fixed amount and one member
///         receives the whole pot. Funds live in this contract; the organizer has no privileged powers after creation
///         other than cancelling a circle that has not started.
contract AjoCircle is Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------------ types

    enum State {
        Open,
        Active,
        Completed,
        Cancelled
    }

    enum OrderMode {
        JoinOrder,
        ReputationOrder
    }

    /// @dev Per-member, per-cycle result. The ledger UI renders this directly.
    enum CycleStatus {
        None, // nothing yet (future cycle, or current cycle not paid yet)
        OnTime,
        Late,
        Covered, // missed, contribution taken from the member's deposit
        Missed // missed and deposit exhausted
    }

    struct Params {
        string name;
        address token;
        uint128 contribution;
        uint32 period;
        uint32 grace;
        uint8 maxMembers;
        uint8 depositMultiple;
        OrderMode orderMode;
        uint64 joinDeadline;
        uint16 minScore;
        address organizer;
    }

    struct Member {
        bool joined;
        bool defaulted; // true after any uncovered default: forfeits own payout
        uint8 defaultCount;
        uint128 deposit;
    }

    struct Summary {
        string name;
        address token;
        address organizer;
        uint128 contribution;
        uint32 period;
        uint32 grace;
        uint8 maxMembers;
        uint8 depositMultiple;
        OrderMode orderMode;
        uint64 joinDeadline;
        uint16 minScore;
        State state;
        uint8 memberCount;
        uint8 settledCycles;
        uint8 paidThisCycle;
        uint64 startTime;
        uint64 currentCycleStart;
        uint8 weight;
    }

    // ------------------------------------------------------------------ storage

    string public name;
    IERC20 public token;
    IReputation public registry;
    address public factory;
    address public organizer;

    uint128 public contribution;
    uint32 public period;
    uint32 public grace;
    uint8 public maxMembers;
    uint8 public depositMultiple;
    OrderMode public orderMode;
    uint64 public joinDeadline;
    uint16 public minScore;
    uint8 public weight; // reputation value tier: 2 = x1, 3 = x1.5, 4 = x2

    State public state;
    uint8 public settledCycles;
    uint8 public paidThisCycle;
    uint64 public startTime;
    uint64 public currentCycleStart;

    address[] private _members; // join order
    address[] private _order; // payout order, fixed when the circle starts
    mapping(address => Member) private _info;
    mapping(uint8 => mapping(address => CycleStatus)) private _status;

    mapping(address => uint256) public claimable;
    uint256 public totalClaimable;
    uint256 public totalDeposits;
    uint256 public heldContributions;

    // ------------------------------------------------------------------ events

    event MemberJoined(address indexed member, uint8 memberCount, uint128 deposit);
    event MemberLeft(address indexed member);
    event CircleStarted(uint64 startTime, address[] payoutOrder);
    event Contributed(address indexed member, uint8 indexed cycle, bool late, uint128 amount);
    event MemberDefaulted(address indexed member, uint8 indexed cycle, bool coveredByDeposit);
    event CycleSettled(uint8 indexed cycle, address indexed recipient, uint256 pot, bool forfeited);
    event PayoutSent(address indexed recipient, uint8 indexed cycle, uint256 amount);
    event CircleCompleted();
    event CircleCancelled();
    event Claimed(address indexed account, uint256 amount);

    // ------------------------------------------------------------------ errors

    error NotOpen();
    error NotActive();
    error NotMember();
    error NotAllowed();
    error JoinClosed();
    error AlreadyMember();
    error CircleFull();
    error ScoreTooLow();
    error CycleNotStarted();
    error CycleClosed();
    error AlreadyPaid();
    error CannotSettleYet();
    error NothingToClaim();
    error BadParams();

    // ------------------------------------------------------------------ init

    constructor() {
        _disableInitializers();
    }

    function initialize(Params calldata p, address registry_, address factory_) external initializer {
        if (p.maxMembers < 2 || p.maxMembers > 12) revert BadParams();
        if (p.contribution == 0 || p.period < 60 || p.grace > p.period) revert BadParams();
        if (p.depositMultiple > 12 || p.joinDeadline <= block.timestamp) revert BadParams();
        if (bytes(p.name).length == 0 || bytes(p.name).length > 48) revert BadParams();

        name = p.name;
        token = IERC20(p.token);
        registry = IReputation(registry_);
        factory = factory_;
        organizer = p.organizer;
        contribution = p.contribution;
        period = p.period;
        grace = p.grace;
        maxMembers = p.maxMembers;
        depositMultiple = p.depositMultiple;
        orderMode = p.orderMode;
        joinDeadline = p.joinDeadline;
        minScore = p.minScore;

        uint256 whole = p.contribution / (10 ** IERC20Metadata(p.token).decimals());
        weight = whole >= 100 ? 4 : whole >= 10 ? 3 : 2;
    }

    // ------------------------------------------------------------------ membership

    function join() external nonReentrant {
        if (state != State.Open) revert NotOpen();
        if (block.timestamp > joinDeadline) revert JoinClosed();
        Member storage m = _info[msg.sender];
        if (m.joined) revert AlreadyMember();
        if (_members.length >= maxMembers) revert CircleFull();
        if (minScore > 0 && registry.scoreOf(msg.sender) < minScore) revert ScoreTooLow();

        uint128 dep = contribution * depositMultiple;
        m.joined = true;
        m.deposit = dep;
        totalDeposits += dep;
        _members.push(msg.sender);

        emit MemberJoined(msg.sender, uint8(_members.length), dep);
        if (factory != address(0)) IAjoFactoryHooks(factory).onMemberJoined(msg.sender);

        if (_members.length == maxMembers) _start();
        if (dep > 0) token.safeTransferFrom(msg.sender, address(this), dep);
    }

    /// @notice Leave before the circle starts; deposit is returned immediately.
    function leave() external nonReentrant {
        if (state != State.Open) revert NotOpen();
        Member storage m = _info[msg.sender];
        if (!m.joined) revert NotMember();

        uint256 len = _members.length;
        uint256 idx;
        for (uint256 i; i < len; ++i) {
            if (_members[i] == msg.sender) {
                idx = i;
                break;
            }
        }
        for (uint256 i = idx; i + 1 < len; ++i) {
            _members[i] = _members[i + 1];
        }
        _members.pop();

        uint128 dep = m.deposit;
        delete _info[msg.sender];
        totalDeposits -= dep;
        emit MemberLeft(msg.sender);
        if (dep > 0) token.safeTransfer(msg.sender, dep);
    }

    /// @notice Organizer can cancel an unstarted circle at any time; anyone can once the join deadline has passed.
    function cancel() external {
        if (state != State.Open) revert NotOpen();
        if (msg.sender != organizer && block.timestamp <= joinDeadline) revert NotAllowed();
        state = State.Cancelled;
        emit CircleCancelled();
    }

    // ------------------------------------------------------------------ cycles

    function contribute() external nonReentrant {
        if (state != State.Active) revert NotActive();
        if (!_info[msg.sender].joined) revert NotMember();
        if (block.timestamp < currentCycleStart) revert CycleNotStarted();

        uint8 c = settledCycles;
        uint256 end = uint256(currentCycleStart) + period;
        if (block.timestamp > end + grace) revert CycleClosed();
        if (_status[c][msg.sender] != CycleStatus.None) revert AlreadyPaid();

        bool late = block.timestamp > end;
        _status[c][msg.sender] = late ? CycleStatus.Late : CycleStatus.OnTime;
        paidThisCycle += 1;
        heldContributions += contribution;

        emit Contributed(msg.sender, c, late, contribution);
        token.safeTransferFrom(msg.sender, address(this), contribution);
    }

    function canSettle() public view returns (bool) {
        if (state != State.Active) return false;
        if (paidThisCycle == _members.length) return block.timestamp >= currentCycleStart;
        return block.timestamp > uint256(currentCycleStart) + period + grace;
    }

    /// @notice Anyone can settle. Allowed once every member has paid, or once the deadline plus grace has passed.
    function settleCycle() external nonReentrant {
        if (!canSettle()) revert CannotSettleYet();

        uint8 c = settledCycles;
        address recipient = _order[c];
        uint256 n = _members.length;
        uint128 amt = contribution;
        uint256 pot;

        // 1) resolve every member's result for this cycle and report to the registry
        for (uint256 i; i < n; ++i) {
            address a = _members[i];
            CycleStatus s = _status[c][a];
            Member storage m = _info[a];
            if (s == CycleStatus.OnTime || s == CycleStatus.Late) {
                pot += amt;
                heldContributions -= amt;
                registry.record(a, s == CycleStatus.OnTime ? Outcome.OnTime : Outcome.Late, weight, amt);
            } else if (m.deposit >= amt) {
                m.deposit -= amt;
                totalDeposits -= amt;
                m.defaultCount += 1;
                _status[c][a] = CycleStatus.Covered;
                pot += amt;
                registry.record(a, Outcome.DefaultCovered, weight, 0);
                emit MemberDefaulted(a, c, true);
            } else {
                m.defaulted = true;
                m.defaultCount += 1;
                _status[c][a] = CycleStatus.Missed;
                registry.record(a, Outcome.DefaultUncovered, weight, 0);
                emit MemberDefaulted(a, c, false);
            }
        }

        // 2) pay out, or refund contributors if the recipient has defaulted without cover
        bool forfeited = _info[recipient].defaulted;
        if (forfeited) {
            for (uint256 i; i < n; ++i) {
                address a = _members[i];
                CycleStatus s = _status[c][a];
                if (s == CycleStatus.OnTime || s == CycleStatus.Late) {
                    _send(a, amt);
                } else if (s == CycleStatus.Covered) {
                    _info[a].deposit += amt; // give the deposit coverage back: nothing was paid out
                    totalDeposits += amt;
                }
            }
        } else if (pot > 0) {
            _send(recipient, pot);
            emit PayoutSent(recipient, c, pot);
        }
        emit CycleSettled(c, recipient, pot, forfeited);

        // 3) advance
        paidThisCycle = 0;
        settledCycles = c + 1;
        if (settledCycles == _order.length) {
            state = State.Completed;
            for (uint256 i; i < n; ++i) {
                address a = _members[i];
                if (_info[a].defaultCount == 0) registry.record(a, Outcome.CircleCompleted, weight, 0);
            }
            emit CircleCompleted();
        } else {
            uint64 next = currentCycleStart + period;
            if (block.timestamp > next) next = uint64(block.timestamp);
            currentCycleStart = next;
        }
    }

    // ------------------------------------------------------------------ withdrawals

    /// @notice Returns the member's remaining deposit once the circle is completed or cancelled.
    function claimRefund() external nonReentrant {
        if (state != State.Completed && state != State.Cancelled) revert NotAllowed();
        Member storage m = _info[msg.sender];
        uint128 dep = m.deposit;
        if (!m.joined || dep == 0) revert NothingToClaim();
        m.deposit = 0;
        totalDeposits -= dep;
        emit Claimed(msg.sender, dep);
        token.safeTransfer(msg.sender, dep);
    }

    /// @notice Pulls funds that could not be pushed during settlement (e.g. a token-level block on the recipient).
    function withdraw() external nonReentrant {
        uint256 amt = claimable[msg.sender];
        if (amt == 0) revert NothingToClaim();
        claimable[msg.sender] = 0;
        totalClaimable -= amt;
        emit Claimed(msg.sender, amt);
        token.safeTransfer(msg.sender, amt);
    }

    // ------------------------------------------------------------------ views

    function summary() external view returns (Summary memory s) {
        s = Summary({
            name: name,
            token: address(token),
            organizer: organizer,
            contribution: contribution,
            period: period,
            grace: grace,
            maxMembers: maxMembers,
            depositMultiple: depositMultiple,
            orderMode: orderMode,
            joinDeadline: joinDeadline,
            minScore: minScore,
            state: state,
            memberCount: uint8(_members.length),
            settledCycles: settledCycles,
            paidThisCycle: paidThisCycle,
            startTime: startTime,
            currentCycleStart: currentCycleStart,
            weight: weight
        });
    }

    function members() external view returns (address[] memory) {
        return _members;
    }

    function payoutOrder() external view returns (address[] memory) {
        return _order;
    }

    function memberInfo(address a) external view returns (Member memory) {
        return _info[a];
    }

    function statusOf(uint8 cycle, address a) external view returns (CycleStatus) {
        return _status[cycle][a];
    }

    function recipientOf(uint8 cycle) external view returns (address) {
        return _order.length > cycle ? _order[cycle] : address(0);
    }

    /// @notice Ledger matrix: rows follow `members()` order, columns are cycles.
    function ledger() external view returns (uint8[][] memory out) {
        uint256 n = _members.length;
        uint256 cycles = state == State.Open || state == State.Cancelled ? 0 : _order.length;
        out = new uint8[][](n);
        for (uint256 i; i < n; ++i) {
            out[i] = new uint8[](cycles);
            for (uint256 c; c < cycles; ++c) {
                out[i][c] = uint8(_status[uint8(c)][_members[i]]);
            }
        }
    }

    // ------------------------------------------------------------------ internals

    function _start() private {
        state = State.Active;
        startTime = uint64(block.timestamp);
        currentCycleStart = uint64(block.timestamp);

        uint256 n = _members.length;
        address[] memory ord = new address[](n);
        for (uint256 i; i < n; ++i) {
            ord[i] = _members[i];
        }
        if (orderMode == OrderMode.ReputationOrder) {
            // stable insertion sort by score, highest first (n <= 12)
            uint16[] memory sc = new uint16[](n);
            for (uint256 i; i < n; ++i) {
                sc[i] = registry.scoreOf(ord[i]);
            }
            for (uint256 i = 1; i < n; ++i) {
                address a = ord[i];
                uint16 s = sc[i];
                uint256 j = i;
                while (j > 0 && sc[j - 1] < s) {
                    ord[j] = ord[j - 1];
                    sc[j] = sc[j - 1];
                    --j;
                }
                ord[j] = a;
                sc[j] = s;
            }
        }
        _order = ord;
        emit CircleStarted(startTime, ord);
    }

    /// @dev Push the payout; if the token refuses the transfer, park it as claimable instead of blocking the circle.
    function _send(address to, uint256 amount) private {
        (bool ok, bytes memory ret) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) {
            claimable[to] += amount;
            totalClaimable += amount;
        }
    }
}
