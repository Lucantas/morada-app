import { overrideStatus } from './override-status';

function fakeRepo() {
  const calls: Array<{ id: string; status: unknown }> = [];
  return {
    setStatusOverride: async (id: string, status: unknown) => {
      calls.push({ id, status });
    },
    calls,
  };
}

describe('overrideStatus', () => {
  it('sets a valid manual status', async () => {
    const repo = fakeRepo();
    await overrideStatus(repo as never, 'r-1', { status: 'em_dia' });
    expect(repo.calls).toEqual([{ id: 'r-1', status: 'em_dia' }]);
  });

  it('clears the override when status is null', async () => {
    const repo = fakeRepo();
    await overrideStatus(repo as never, 'r-1', { status: null });
    expect(repo.calls).toEqual([{ id: 'r-1', status: null }]);
  });

  it('rejects an invalid status', async () => {
    const repo = fakeRepo();
    await expect(overrideStatus(repo as never, 'r-1', { status: 'bogus' })).rejects.toBeTruthy();
  });
});
