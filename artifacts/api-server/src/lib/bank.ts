export const BANK_CONFIG = {
  // 0.1% per hour, applied via integer arithmetic: floor(balance / 1000)
  INTEREST_DIVISOR: 1000,
  // Cap how far the worker will catch up if it's been offline a long time.
  MAX_INTEREST_CATCHUP_HOURS: 168,
  // Loan parameters
  LOAN_TERM_DAYS: 7,
  LOAN_INTEREST_PERCENT: 5,
  // Credit limit derivation: level * LEVEL_MULT + propertyCount * PROPERTY_MULT
  CREDIT_LEVEL_MULT: 50_000,
  CREDIT_PROPERTY_MULT: 100_000,
  // A bedrock credit floor so rank-1 / no-property players can still borrow.
  CREDIT_MINIMUM: 25_000,
} as const;

export function loanInterestAmount(principal: number): number {
  return Math.floor((principal * BANK_CONFIG.LOAN_INTEREST_PERCENT) / 100);
}

export function loanTotalDue(principal: number): number {
  return principal + loanInterestAmount(principal);
}

// Apply 0.1%/hour compounded for `hours` ticks using integer math.
// Returns total interest accrued (newBalance - startBalance).
export function applyHourlyInterest(startBalance: number, hours: number): { newBalance: number; interest: number } {
  if (startBalance <= 0 || hours <= 0) return { newBalance: startBalance, interest: 0 };
  let bal = startBalance;
  for (let i = 0; i < hours; i++) {
    const tick = Math.floor(bal / BANK_CONFIG.INTEREST_DIVISOR);
    if (tick <= 0) break;
    bal += tick;
  }
  return { newBalance: bal, interest: bal - startBalance };
}
