import { InMemoryCondoInfoRepository } from './in-memory-condo-info-repository';

describe('InMemoryCondoInfoRepository', () => {
  test('rename trims and stores the new name', async () => {
    const repo = new InMemoryCondoInfoRepository({ id: 'c1', name: 'Antigo' });

    const renamed = await repo.rename('  Novo  ');

    expect(renamed).toEqual({ id: 'c1', name: 'Novo' });
    expect(await repo.get()).toEqual({ id: 'c1', name: 'Novo' });
  });

  test('rename rejects a blank name and keeps the old one', async () => {
    const repo = new InMemoryCondoInfoRepository({ id: 'c1', name: 'Antigo' });

    await expect(repo.rename('  ')).rejects.toThrow();
    expect(repo.snapshot().name).toBe('Antigo');
  });
});
