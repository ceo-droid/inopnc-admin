# Expense allocation additive schema prerequisite

Status: READY FOR REVIEW. This document does not contain SQL and has not changed a remote database.

`transactions` remains immutable source evidence and keeps its existing UUID. Assignment, category correction, void and restore commands require an additive `expense_allocations` model before they may write remotely. The minimum contract is represented by `EXPENSE_ALLOCATION_PREREQUISITE` in `src/services/expenseCommands.ts`: transaction reference, site/category assignment, active/void status, source namespace/row key/fingerprint, and void timestamp.

Until that schema is applied and verified, `updateExpenseAssignment`, `correctExpense`, `voidExpense`, `restoreExpense`, and confirmed file import fail closed. Manual `createExpense` remains the only supported write. Existing `transactions.site_id` is compatibility data, not fuzzy-match authority. Unknown or ambiguous sites remain review items; S067 and S068 are never merged.
