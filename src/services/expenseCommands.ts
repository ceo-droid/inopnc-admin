import { supabase } from '@/integrations/supabase/client';
import type { Transaction } from '@/types';

export const EXPENSE_ALLOCATION_PREREQUISITE = {
  table: 'expense_allocations',
  additiveColumns: ['transaction_id', 'site_id', 'category', 'status', 'source_namespace', 'source_row_key', 'source_fingerprint', 'voided_at'],
  requiredBefore: ['updateExpenseAssignment', 'correctExpense', 'voidExpense', 'restoreExpense', 'confirmedImport'],
} as const;

export class ExpenseSchemaPrerequisiteError extends Error {
  constructor(command: string) {
    super(`${command}: expense_allocations additive schema가 먼저 필요합니다.`);
    this.name = 'ExpenseSchemaPrerequisiteError';
  }
}

export interface ExpenseCommandBoundary {
  createExpense(expense: Transaction): Promise<Transaction>;
  updateExpenseAssignment(id: string, siteId: string): Promise<never>;
  correctExpense(id: string, correction: Partial<Pick<Transaction, 'date' | 'category' | 'description' | 'amount'>>): Promise<never>;
  voidExpense(id: string): Promise<never>;
  restoreExpense(id: string): Promise<never>;
}

export const expenseCommands: ExpenseCommandBoundary = {
  async createExpense(expense) {
    const row = { id: expense.id, date: expense.date, site_id: expense.site_id || null, category: expense.category, description: expense.description || null, amount: expense.amount };
    const { data, error } = await (supabase as any).from('transactions').insert(row).select().single();
    if (error) throw error;
    return { ...expense, ...data, worker_id: data.worker_id ?? expense.worker_id ?? '', type: 'expense' };
  },
  async updateExpenseAssignment() { throw new ExpenseSchemaPrerequisiteError('updateExpenseAssignment'); },
  async correctExpense() { throw new ExpenseSchemaPrerequisiteError('correctExpense'); },
  async voidExpense() { throw new ExpenseSchemaPrerequisiteError('voidExpense'); },
  async restoreExpense() { throw new ExpenseSchemaPrerequisiteError('restoreExpense'); },
};
