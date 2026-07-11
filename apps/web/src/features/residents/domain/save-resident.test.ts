import { InMemoryResidentRepository } from '../data/in-memory-resident-repository';

import { ResidentValidationError } from './errors';
import { saveResident } from './save-resident';

describe('saveResident', () => {
  test('assigns an id when the draft has none', async () => {
    const repo = new InMemoryResidentRepository([]);

    const saved = await saveResident(repo, {
      name: 'Maria Ribeiro',
      apt: 'Apto 302',
      phone: '(11) 90000-0000',
      email: 'maria@email.com',
      status: 'em_dia',
    });

    expect(saved.id).toMatch(/.+/);
    expect(await repo.getById(saved.id)).toEqual(saved);
  });

  test('keeps the id when editing an existing resident', async () => {
    const repo = new InMemoryResidentRepository([]);

    const saved = await saveResident(repo, {
      id: 'r-1',
      name: 'Maria',
      apt: 'Apto 302',
      phone: '',
      email: '',
      status: 'pendente',
    });

    expect(saved.id).toBe('r-1');
  });

  test('rejects a draft with an empty name', async () => {
    const repo = new InMemoryResidentRepository([]);

    await expect(
      saveResident(repo, { name: '', apt: 'Apto 1', phone: '', email: '', status: 'em_dia' }),
    ).rejects.toBeInstanceOf(ResidentValidationError);
  });
});
