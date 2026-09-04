import type { Transaction } from '@/types';

export const isActiveExpense = (expense: Transaction) => expense.is_active !== false && expense.status !== 'void';

export const mergeExpensesById = (existing: Transaction[], incoming: Transaction[]) => {
  const ids = new Set(existing.map((item) => item.id));
  return [...existing, ...incoming.filter((item) => !ids.has(item.id))];
};

export const canIdempotentlyImport = (row: Pick<Transaction, 'source_namespace' | 'source_row_key' | 'source_fingerprint'>) =>
  Boolean(row.source_namespace && row.source_row_key && row.source_fingerprint);
