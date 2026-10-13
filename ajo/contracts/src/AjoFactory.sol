// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {AjoCircle} from "./AjoCircle.sol";
import {IReputation} from "./interfaces/IReputation.sol";

/// @title AjoFactory
/// @notice Deploys circles as minimal-proxy clones, whitelists tokens, and keeps an on-chain index so the app and
///         keeper can discover circles without a separate indexer.
contract AjoFactory is Ownable {
    address public immutable implementation;
    IReputation public immutable registry;

    address[] private _circles;
    mapping(address => bool) public isCircle;
    mapping(address => bool) public tokenAllowed;
    mapping(address => address[]) private _byOrganizer;
    mapping(address => address[]) private _byMember;

    event CircleCreated(address indexed circle, address indexed organizer, address indexed token, string name);
    event TokenAllowed(address indexed token, bool allowed);

    error TokenNotAllowed();
    error NotCircle();

    constructor(address registry_, address owner_) Ownable(owner_) {
        registry = IReputation(registry_);
        implementation = address(new AjoCircle());
    }

    function setTokenAllowed(address token, bool allowed) external onlyOwner {
        tokenAllowed[token] = allowed;
        emit TokenAllowed(token, allowed);
    }

    function createCircle(AjoCircle.Params calldata p) external returns (address circle) {
        if (!tokenAllowed[p.token]) revert TokenNotAllowed();

        AjoCircle.Params memory q = p;
        q.organizer = msg.sender; // never trust the caller-supplied organizer field

        circle = Clones.clone(implementation);
        isCircle[circle] = true;
        _circles.push(circle);
        _byOrganizer[msg.sender].push(circle);

        registry.registerWriter(circle);
        AjoCircle(circle).initialize(q, address(registry), address(this));

        emit CircleCreated(circle, msg.sender, p.token, p.name);
    }

    /// @dev Called by circles so "my circles" works without an indexer.
    function onMemberJoined(address member) external {
        if (!isCircle[msg.sender]) revert NotCircle();
        _byMember[member].push(msg.sender);
    }

    function circleCount() external view returns (uint256) {
        return _circles.length;
    }

    /// @notice Newest-first page of circles.
    function getCircles(uint256 offset, uint256 limit) external view returns (address[] memory out) {
        uint256 total = _circles.length;
        if (offset >= total) return new address[](0);
        uint256 n = total - offset;
        if (n > limit) n = limit;
        out = new address[](n);
        for (uint256 i; i < n; ++i) {
            out[i] = _circles[total - 1 - offset - i];
        }
    }

    function circlesOfOrganizer(address a) external view returns (address[] memory) {
        return _byOrganizer[a];
    }

    function circlesOfMember(address a) external view returns (address[] memory) {
        return _byMember[a];
    }
}
