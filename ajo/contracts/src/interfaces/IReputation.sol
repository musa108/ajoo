// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Outcomes that circles and the credit pool report to the reputation registry.
enum Outcome {
    OnTime,
    Late,
    DefaultCovered,
    DefaultUncovered,
    CircleCompleted,
    CreditRepaid,
    CreditDefaulted
}

interface IReputation {
    function scoreOf(address member) external view returns (uint16);

    /// @param weight value-tier multiplier in halves (2 = x1, 3 = x1.5, 4 = x2); ignored by outcomes that do not scale
    /// @param amount token amount to add to `totalContributed` (only used for OnTime / Late)
    function record(address member, Outcome outcome, uint8 weight, uint128 amount) external;

    function registerWriter(address writer) external;
}
