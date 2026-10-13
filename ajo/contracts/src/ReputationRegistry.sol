// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IReputation, Outcome} from "./interfaces/IReputation.sol";

/// @title ReputationRegistry
/// @notice Non-transferable, append-only-by-rules savings reputation. There is no token and no transfer function:
///         a score belongs to an address by construction. Only authorised writers (circles created by the
///         factory, and the credit pool) can change it.
/// @dev    Score is in [0, 1000]. Parameters are constants so judges can read the whole policy in one place.
contract ReputationRegistry is IReputation, Ownable {
    uint16 public constant MAX_SCORE = 1000;

    uint16 public constant PTS_ON_TIME = 10; // multiplied by weight / 2
    uint16 public constant PTS_LATE_PENALTY = 5;
    uint16 public constant PTS_DEFAULT_COVERED_PENALTY = 60;
    uint16 public constant PTS_DEFAULT_UNCOVERED_PENALTY = 200;
    uint16 public constant PTS_CIRCLE_COMPLETED = 50;
    uint16 public constant PTS_CREDIT_REPAID = 25;
    uint16 public constant PTS_CREDIT_DEFAULT_PENALTY = 300;

    struct Stats {
        uint16 score;
        uint32 onTime;
        uint32 late;
        uint32 defaultsCovered;
        uint32 defaultsUncovered;
        uint32 circlesCompleted;
        uint32 creditRepaid;
        uint32 creditDefaulted;
        uint128 totalContributed;
    }

    mapping(address => Stats) private _stats;
    mapping(address => bool) public isWriter;
    mapping(address => bool) public isRegistrar;

    event WriterSet(address indexed writer, bool allowed);
    event RegistrarSet(address indexed registrar, bool allowed);
    event ReputationUpdated(
        address indexed member, Outcome indexed outcome, uint16 oldScore, uint16 newScore, address indexed writer
    );

    error NotWriter();
    error NotRegistrar();

    constructor(address owner_) Ownable(owner_) {}

    // ---------------------------------------------------------------- admin

    function setWriter(address writer, bool allowed) external onlyOwner {
        isWriter[writer] = allowed;
        emit WriterSet(writer, allowed);
    }

    function setRegistrar(address registrar, bool allowed) external onlyOwner {
        isRegistrar[registrar] = allowed;
        emit RegistrarSet(registrar, allowed);
    }

    /// @notice Called by the factory to authorise a freshly created circle.
    function registerWriter(address writer) external {
        if (!isRegistrar[msg.sender]) revert NotRegistrar();
        isWriter[writer] = true;
        emit WriterSet(writer, true);
    }

    // ---------------------------------------------------------------- writes

    function record(address member, Outcome outcome, uint8 weight, uint128 amount) external {
        if (!isWriter[msg.sender]) revert NotWriter();
        Stats storage s = _stats[member];
        uint16 old = s.score;
        uint256 next = old;

        if (outcome == Outcome.OnTime) {
            s.onTime += 1;
            s.totalContributed += amount;
            uint256 w = weight < 2 ? 2 : weight;
            next += (uint256(PTS_ON_TIME) * w) / 2;
        } else if (outcome == Outcome.Late) {
            s.late += 1;
            s.totalContributed += amount;
            next = _sub(next, PTS_LATE_PENALTY);
        } else if (outcome == Outcome.DefaultCovered) {
            s.defaultsCovered += 1;
            next = _sub(next, PTS_DEFAULT_COVERED_PENALTY);
        } else if (outcome == Outcome.DefaultUncovered) {
            s.defaultsUncovered += 1;
            next = _sub(next, PTS_DEFAULT_UNCOVERED_PENALTY);
        } else if (outcome == Outcome.CircleCompleted) {
            s.circlesCompleted += 1;
            next += PTS_CIRCLE_COMPLETED;
        } else if (outcome == Outcome.CreditRepaid) {
            s.creditRepaid += 1;
            next += PTS_CREDIT_REPAID;
        } else {
            s.creditDefaulted += 1;
            next = _sub(next, PTS_CREDIT_DEFAULT_PENALTY);
        }

        if (next > MAX_SCORE) next = MAX_SCORE;
        s.score = uint16(next);
        emit ReputationUpdated(member, outcome, old, s.score, msg.sender);
    }

    // ---------------------------------------------------------------- reads

    function scoreOf(address member) external view returns (uint16) {
        return _stats[member].score;
    }

    function statsOf(address member) external view returns (Stats memory) {
        return _stats[member];
    }

    function _sub(uint256 a, uint256 b) private pure returns (uint256) {
        return a > b ? a - b : 0;
    }
}
