export const EXPENSE_CATEGORIES = ['아침', '점심', '저녁', '간식', '주유', '숙박', '자재', '장비', '기타'] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const isExpenseCategory = (value: string): value is ExpenseCategory =>
  EXPENSE_CATEGORIES.includes(value as ExpenseCategory);
