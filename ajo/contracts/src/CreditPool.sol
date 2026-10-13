// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IReputation, Outcome} from "./interfaces/IReputation.sol";

/// @title CreditPool
/// @notice Reputation-gated micro-credit. Lenders supply stablecoins and earn the flat fee borrowers pay;
///         borrowers with a high enough Ajo score draw an unsecured loan up to a limit that grows with their score.
///         Repayment and default feed straight back into the same reputation registry.
/// @dev    PROTOTYPE. Unsecured lending can lose lenders' money. Not audited. Parameters are owner-adjustable bounds
///         so a deployment can start conservative.
contract CreditPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    IReputation public immutable registry;

    // ----- policy (owner can tune within hard caps)
    uint16 public minScore = 400;
    uint256 public creditPerPoint; // token units of credit per score point above minScore
    uint16 public feeBps = 300; // flat fee, 3.00%
    uint32 public term = 14 days;
    uint32 public defaultGrace = 3 days;
    uint16 public constant MAX_FEE_BPS = 2_000;

    // ----- lender accounting (share based)
    uint256 public totalShares;
    mapping(address => uint256) public sharesOf;
    uint256 public totalLoaned; // principal currently outstanding

    struct Loan {
        uint128 principalOut;
        uint128 feeOut;
        uint64 due;
        bool open;
    }

    mapping(address => Loan) public loans;

    event Supplied(address indexed lender, uint256 amount, uint256 shares);
    event Withdrawn(address indexed lender, uint256 amount, uint256 shares);
    event Borrowed(address indexed borrower, uint256 principal, uint256 fee, uint64 due);
    event Repaid(address indexed borrower, uint256 amount, bool closed);
    event Defaulted(address indexed borrower, uint256 writtenOff);
    event PolicyUpdated(uint16 minScore, uint256 creditPerPoint, uint16 feeBps, uint32 term, uint32 defaultGrace);

    error ScoreTooLow();
    error OverLimit();
    error LoanOpen();
    error NoLoan();
    error NotLiquid();
    error NotDefaultable();
    error ZeroAmount();
    error BadPolicy();

    constructor(address token_, address registry_, address owner_, uint256 creditPerPoint_) Ownable(owner_) {
        token = IERC20(token_);
        registry = IReputation(registry_);
        creditPerPoint = creditPerPoint_;
    }

    // ------------------------------------------------------------------ policy

    function setPolicy(uint16 minScore_, uint256 creditPerPoint_, uint16 feeBps_, uint32 term_, uint32 defaultGrace_)
        external
        onlyOwner
    {
        if (feeBps_ > MAX_FEE_BPS || term_ < 1 hours || minScore_ > 1000) revert BadPolicy();
        minScore = minScore_;
        creditPerPoint = creditPerPoint_;
        feeBps = feeBps_;
        term = term_;
        defaultGrace = defaultGrace_;
        emit PolicyUpdated(minScore_, creditPerPoint_, feeBps_, term_, defaultGrace_);
    }

    // ------------------------------------------------------------------ lenders

    function totalAssets() public view returns (uint256) {
        return token.balanceOf(address(this)) + totalLoaned;
    }

    function idle() public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function supply(uint256 amount) external nonReentrant returns (uint256 shares) {
        if (amount == 0) revert ZeroAmount();
        // virtual +1 offsets blunt first-depositor share inflation
        shares = (amount * (totalShares + 1)) / (totalAssets() + 1);
        totalShares += shares;
        sharesOf[msg.sender] += shares;
        emit Supplied(msg.sender, amount, shares);
        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 shares) external nonReentrant returns (uint256 amount) {
        if (shares == 0) revert ZeroAmount();
        amount = (shares * (totalAssets() + 1)) / (totalShares + 1);
        if (amount > idle()) revert NotLiquid();
        sharesOf[msg.sender] -= shares;
        totalShares -= shares;
        emit Withdrawn(msg.sender, amount, shares);
        token.safeTransfer(msg.sender, amount);
    }

    function valueOf(address lender) external view returns (uint256) {
        return (sharesOf[lender] * (totalAssets() + 1)) / (totalShares + 1);
    }

    // ------------------------------------------------------------------ borrowers

    function creditLimit(address who) public view returns (uint256) {
        uint16 s = registry.scoreOf(who);
        if (s < minScore) return 0;
        return uint256(s - minScore) * creditPerPoint;
    }

    function borrow(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (loans[msg.sender].open) revert LoanOpen();
        if (registry.scoreOf(msg.sender) < minScore) revert ScoreTooLow();
        if (amount > creditLimit(msg.sender)) revert OverLimit();
        if (amount > idle()) revert NotLiquid();

        uint256 fee = (amount * feeBps) / 10_000;
        uint64 due = uint64(block.timestamp + term);
        loans[msg.sender] = Loan({principalOut: uint128(amount), feeOut: uint128(fee), due: due, open: true});
        totalLoaned += amount;

        emit Borrowed(msg.sender, amount, fee, due);
        token.safeTransfer(msg.sender, amount);
    }

    function owed(address who) public view returns (uint256) {
        Loan memory l = loans[who];
        return uint256(l.principalOut) + l.feeOut;
    }

    /// @notice Repay principal first, then fee. Overpayment is capped.
    function repay(uint256 amount) external nonReentrant {
        Loan storage l = loans[msg.sender];
        if (!l.open) revert NoLoan();
        if (amount == 0) revert ZeroAmount();

        uint256 due = uint256(l.principalOut) + l.feeOut;
        if (amount > due) amount = due;

        uint256 toPrincipal = amount > l.principalOut ? l.principalOut : amount;
        uint256 toFee = amount - toPrincipal;
        l.principalOut -= uint128(toPrincipal);
        l.feeOut -= uint128(toFee);
        totalLoaned -= toPrincipal;

        bool closed = l.principalOut == 0 && l.feeOut == 0;
        if (closed) delete loans[msg.sender];

        emit Repaid(msg.sender, amount, closed);
        token.safeTransferFrom(msg.sender, address(this), amount);
        if (closed) registry.record(msg.sender, Outcome.CreditRepaid, 0, 0);
    }

    /// @notice Anyone can write off a loan that is past due plus grace. This hits the borrower's score hard.
    function markDefault(address borrower) external nonReentrant {
        Loan memory l = loans[borrower];
        if (!l.open) revert NoLoan();
        if (block.timestamp <= uint256(l.due) + defaultGrace) revert NotDefaultable();
        totalLoaned -= l.principalOut;
        delete loans[borrower];
        emit Defaulted(borrower, l.principalOut);
        registry.record(borrower, Outcome.CreditDefaulted, 0, 0);
    }
}
