import { CondoValidationError } from '../domain/errors';

import { renameCondo } from './condo-info';

describe('renameCondo', () => {
  test('throws CondoValidationError (400) for an invalid name', async () => {
    const condos = { rename: async () => ({ id: 'c', name: 'x' }) } as never;

    const error = await renameCondo(condos, 'c', { name: '' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CondoValidationError);
    expect((error as CondoValidationError).status).toBe(400);
    expect((error as CondoValidationError).message).toBe('Dados inválidos');
  });
});
