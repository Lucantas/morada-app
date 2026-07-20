import type { Receipt } from './receipt';

import { sortByDueDateDesc } from './sort-by-due-date';

const mk = (id: string, ref: string, dueDate: string | null): Receipt =>
  ({ id, ref, dueDate }) as Receipt;

test('orders by dueDate desc, nulls last, stable by id', () => {
  const out = sortByDueDateDesc([
    mk('a', '04/2026', '2026-04-15'),
    mk('b', '', null),
    mk('c', '06/2026', '2026-06-15'),
  ]);
  expect(out.map((r) => r.id)).toEqual(['c', 'a', 'b']);
});

test('keeps chronology across year boundaries', () => {
  const out = sortByDueDateDesc([
    mk('a', '01/2026', '2026-01-15'),
    mk('b', '12/2025', '2025-12-15'),
    mk('c', '11/2025', '2025-11-15'),
  ]);
  expect(out.map((r) => r.ref)).toEqual(['01/2026', '12/2025', '11/2025']);
});

test('falls back to the ref month when dueDate is null', () => {
  const out = sortByDueDateDesc([
    mk('a', '02/2026', null),
    mk('b', '07/2026', null),
    mk('c', '01/2026', null),
  ]);
  expect(out.map((r) => r.ref)).toEqual(['07/2026', '02/2026', '01/2026']);
});

test('does not mutate the input', () => {
  const input = [mk('a', '01/2026', '2026-01-01')];
  sortByDueDateDesc(input);
  expect(input).toHaveLength(1);
});
