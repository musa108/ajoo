import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError, InsufficientFundsError } from "viem";

const MESSAGES: Record<string, string> = {
  NotOpen: "This circle is not open to new members.",
  NotActive: "This circle has not started, or has already finished.",
  NotMember: "Only members of this circle can do that.",
  NotAllowed: "That action is not available right now.",
  JoinClosed: "The joining deadline has passed.",
  AlreadyMember: "You are already in this circle.",
  CircleFull: "This circle is full.",
  ScoreTooLow: "Your reputation score is below what this requires.",
  CycleNotStarted: "The next cycle has not started yet. Come back when it opens.",
  CycleClosed: "This cycle's payment window has closed. Anyone can settle it.",
  AlreadyPaid: "You already paid for this cycle.",
  CannotSettleYet: "Not everyone has paid and the deadline has not passed yet.",
  NothingToClaim: "There is nothing to claim.",
  BadParams: "Those terms are not valid. Check the numbers and try again.",
  TokenNotAllowed: "That token is not enabled on this deployment.",
  OverLimit: "That is above your credit limit.",
  LoanOpen: "Repay your current loan before borrowing again.",
  NoLoan: "There is no open loan.",
  NotLiquid: "The pool does not have enough free funds for that right now.",
  NotDefaultable: "This loan is not overdue yet.",
  ZeroAmount: "Enter an amount greater than zero.",
  ERC20InsufficientBalance: "Your balance is too low for this payment.",
  ERC20InsufficientAllowance: "Approve the token first, then try again.",
};

/** Turns a viem / wallet error into one plain sentence: what happened and what to do. */
export function explain(e: unknown): string {
  if (e instanceof BaseError) {
    if (e.walk((x) => x instanceof UserRejectedRequestError)) return "You cancelled the request in your wallet.";
    if (e.walk((x) => x instanceof InsufficientFundsError)) return "Not enough gas in your wallet. Add some native token and try again.";
    const reverted = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    const name = reverted?.data?.errorName;
    if (name && MESSAGES[name]) return MESSAGES[name];
    if (reverted?.reason) return reverted.reason;
    return e.shortMessage || "The transaction failed. Try again.";
  }
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}
