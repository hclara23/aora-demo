/** Decimal USD input, with no floating-point money arithmetic. Blank means unknown. */
export const cents = (value) => {
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(value.trim());
  return match ? BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0')) : null;
};
export const summarizeCosts = (values) => {
  const amounts = values.map(cents);
  return {
    total: amounts.reduce((sum, amount) => sum + (amount ?? 0n), 0n),
    complete: amounts.every((amount) => amount !== null),
  };
};
export const dollars = (amount) => `$${amount / 100n}.${String(amount % 100n).padStart(2, '0')}`;
