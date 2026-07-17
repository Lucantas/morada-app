import { sortByDueDateDesc } from './sort-by-due-date';

test('orders by dueDate desc, nulls last, stable by id', () => {
  const mk = (id: string, dueDate: string | null) => ({ id, dueDate }) as never;
  const out = sortByDueDateDesc([mk('a', '2026-04-15'), mk('b', null), mk('c', '2026-06-15')]);
  expect(out.map((r) => r.id)).toEqual(['c', 'a', 'b']);
});

test('does not mutate the input', () => {
  const input = [{ id: 'a', dueDate: '2026-01-01' }] as never[];
  sortByDueDateDesc(input);
  expect(input).toHaveLength(1);
});
