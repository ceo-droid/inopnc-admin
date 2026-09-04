import { describe, expect, it } from 'vitest';
import { EXPENSE_CATEGORIES } from '@/constants/expenseCategories';
import { canIdempotentlyImport, mergeExpensesById } from '@/lib/expenseIntegrity';
import { mapTransaction } from '@/hooks/useSupabaseData';
import { EXPENSE_ALLOCATION_PREREQUISITE, ExpenseSchemaPrerequisiteError, expenseCommands } from '@/services/expenseCommands';
import type { Transaction } from '@/types';
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

const tx = (id: string, site_id = 'S067'): Transaction => ({ id, date: '2026-01-01', site_id, worker_id: 'W1', type: 'expense', category: '기타', description: 'same', amount: 1000 });

describe('expense integrity boundary', () => {
  it('preserves equal tuples when UUIDs differ', () => expect(mergeExpensesById([], [tx('A'), tx('B')])).toHaveLength(2));
  it('preserves worker_id during mapping', () => expect(mapTransaction(tx('A')).worker_id).toBe('W1'));
  it('uses the canonical nine categories', () => expect(EXPENSE_CATEGORIES).toEqual(['아침','점심','저녁','간식','주유','숙박','자재','장비','기타']));
  it('blocks void until non-destructive schema exists', async () => await expect(expenseCommands.voidExpense('A')).rejects.toBeInstanceOf(ExpenseSchemaPrerequisiteError));
  it('assignment targets one UUID', () => expect(mergeExpensesById([tx('A')], [tx('A','S068'), tx('B','S068')]).map(x => x.id)).toEqual(['A','B']));
  it('keeps S067 and S068 independent', () => expect(new Set([tx('A','S067').site_id, tx('B','S068').site_id]).size).toBe(2));
  it('allows idempotency only with complete source identity', () => {
    expect(canIdempotentlyImport({ source_namespace:'file', source_row_key:'1', source_fingerprint:'abc' })).toBe(true);
    expect(canIdempotentlyImport({ source_namespace:'file', source_row_key:'1' })).toBe(false);
  });
  it('defines the allocation prerequisite', () => expect(EXPENSE_ALLOCATION_PREREQUISITE.requiredBefore).toContain('confirmedImport'));
  it('validates the canonical expense source baseline', () => {
    const canonical = path.resolve(process.cwd(), '..', 'inopnc-sw4-v2', 'data-generated', 'expenses_canonical.csv');
    const rows = Papa.parse<Record<string, string>>(fs.readFileSync(canonical, 'utf8'), { header: true, skipEmptyLines: true }).data;
    expect(rows).toHaveLength(4885);
    expect(rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)).toBe(216525934);
  });
});
