export * from "./abis";

/** Mirrors AjoCircle.State */
export const CircleState = { Open: 0, Active: 1, Completed: 2, Cancelled: 3 } as const;
/** Mirrors AjoCircle.OrderMode */
export const OrderMode = { JoinOrder: 0, ReputationOrder: 1 } as const;
/** Mirrors AjoCircle.CycleStatus */
export const CycleStatus = { None: 0, OnTime: 1, Late: 2, Covered: 3, Missed: 4 } as const;
