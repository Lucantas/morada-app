# Code follow-ups — design (dead code, domain error, atomic categories, income soft-delete)

Four deferred code follow-ups, verified pending against the code on 2026-07-21.

## 1. Remove dead `active-notices` from the API

`apps/api/src/notices/app/active-notices.ts` still filters on a `dismissed` flag that
migration `010_notice_dismissals` moved to a per-resident join table. Nothing in the API
imports it (the SQL adapter computes dismissal per viewer); only the web has its own,
still-used copy. Delete the API file and its test (`active-notices.test.ts`). No behavior
change.

## 2. Domain error on the `dismiss()` post-insert race

`PostgresNoticeRepository.dismiss()` throws a plain `Error` when `getById` misses right
after the dismissal insert (notice deleted concurrently). Throw the existing
`NoticeNotFoundError(noticeId)` instead — the situation is exactly "the notice no longer
exists", and the route layer already maps that domain error to a 404 instead of a 500.

## 3. Atomic `saveCategories`

Today `repo.replaceAll(categories)` commits its own transaction, then the app layer saves
reclassified accounts one-by-one through a port — a mid-loop failure leaves accounts
inconsistent with the committed categories.

Design: the reclassification result becomes part of the repository transaction.

- `CategoryRepository.replaceAll(categories, accountUpdates)` gains a second parameter
  `accountUpdates: { id: string; category: string }[]`. The Postgres adapter executes the
  category replace AND every `UPDATE accounts SET category = $2 WHERE id = $1` inside the
  SAME `BEGIN/COMMIT`.
- The app layer computes updates BEFORE persisting: parse categories → `accounts.list()`
  → `reclassifyAccounts(categories, current)` → single
  `repo.replaceAll(categories, updates)` call.
- The `AccountsForReclassify` port loses `save` (only `list` remains); `compose.ts` drops
  the save closure it wired.
- Touching the `accounts` table from the categories adapter is deliberate: adapters share
  the platform-owned schema, and the boundary rules govern imports, not SQL. The update
  list arrives as plain data from the app layer, so no cross-feature import appears.

## 4. Income soft-delete (align with receipts/accounts)

Income is the only feature with a hard `DELETE FROM incomes` — violating the project rule
that nothing is ever fully deleted (receipts/accounts archive via a `visible` flag since
migration `009_visible`).

- Migration `011_income_visible` (append-only): `ALTER TABLE incomes ADD COLUMN visible
boolean NOT NULL DEFAULT true`.
- `IncomeRepository.delete(id)` → `archive(id)` implemented as
  `UPDATE incomes SET visible = false WHERE id = $1`; `list`/`getById` filter
  `visible = true`; the dashboard's incomes query also filters `visible = true` so
  archived incomes stop counting.
- Use case `delete-income.ts` → `archive-income.ts` (`archiveIncome`); the HTTP route
  `DELETE /api/incomes/:id` keeps its verb and `204` contract (external API unchanged).
- Web: `IncomeRepository.remove` → `archive`, hook `useDeleteIncome` → `useArchiveIncome`;
  UI behavior unchanged (the "Excluir" confirm keeps its copy — archiving is the
  implementation, per the no-hard-delete rule).
- `visible` stays persistence-only (NOT in the domain Zod schemas), same as
  receipts/accounts.

## Testing

TDD per item: a RED test proving the new behavior (dismiss race → 404-class error;
replaceAll rolls back account updates on failure; archived income invisible to
list/getById/dashboard) before each change. Gates `make api-check` + `make check` green;
coverage ≥ 80%.

## Out of scope

- Web `active-notices` copy (still used).
- Any receipts/accounts changes.
- Restoring/unarchiving incomes (no product ask).
