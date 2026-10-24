import { pixSettingsSchema } from './pix-settings';

const base = { receiverName: 'Condominio Morada', city: 'Sao Paulo' };

describe('pixSettingsSchema', () => {
  test('normalizes a formatted CPF', () => {
    const result = pixSettingsSchema.parse({ ...base, keyType: 'cpf', key: '529.982.247-25' });

    expect(result.key).toBe('52998224725');
  });

  test('normalizes a formatted CNPJ', () => {
    const result = pixSettingsSchema.parse({
      ...base,
      keyType: 'cnpj',
      key: '11.222.333/0001-81',
    });

    expect(result.key).toBe('11222333000181');
  });

  test('normalizes e-mail, phone and random keys', () => {
    expect(pixSettingsSchema.parse({ ...base, keyType: 'email', key: ' A@B.com ' }).key).toBe(
      'a@b.com',
    );
    expect(
      pixSettingsSchema.parse({ ...base, keyType: 'telefone', key: '(11) 98765-4321' }).key,
    ).toBe('+5511987654321');
    expect(
      pixSettingsSchema.parse({
        ...base,
        keyType: 'aleatoria',
        key: '123E4567-E12B-12D1-A456-426655440000',
      }).key,
    ).toBe('123e4567-e12b-12d1-a456-426655440000');
  });

  test.each([
    ['cpf', '111.111.111-11'],
    ['cpf', '123'],
    ['cnpj', '11.222.333/0001-82'],
    ['email', 'not-an-email'],
    ['telefone', '123'],
    ['aleatoria', 'abc'],
  ] as const)('rejects an invalid %s key %s', (keyType, key) => {
    const result = pixSettingsSchema.safeParse({ ...base, keyType, key });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Chave Pix inválida');
  });

  test('requires a receiver name up to 25 characters', () => {
    const empty = pixSettingsSchema.safeParse({
      ...base,
      receiverName: ' ',
      keyType: 'email',
      key: 'a@b.com',
    });
    const long = pixSettingsSchema.safeParse({
      ...base,
      receiverName: 'x'.repeat(26),
      keyType: 'email',
      key: 'a@b.com',
    });

    expect(empty.error?.issues[0]?.message).toBe('Informe o nome do recebedor (até 25 caracteres)');
    expect(long.success).toBe(false);
  });

  test('requires a city up to 15 characters', () => {
    const result = pixSettingsSchema.safeParse({
      ...base,
      city: 'x'.repeat(16),
      keyType: 'email',
      key: 'a@b.com',
    });

    expect(result.error?.issues[0]?.message).toBe('Informe a cidade (até 15 caracteres)');
  });

  test('rejects a receiver name or city that has no printable characters', () => {
    const name = pixSettingsSchema.safeParse({
      ...base,
      receiverName: '😀ø',
      keyType: 'email',
      key: 'a@b.com',
    });
    const city = pixSettingsSchema.safeParse({
      ...base,
      city: '😀',
      keyType: 'email',
      key: 'a@b.com',
    });

    expect(name.error?.issues[0]?.message).toBe('Informe o nome do recebedor (até 25 caracteres)');
    expect(city.error?.issues[0]?.message).toBe('Informe a cidade (até 15 caracteres)');
  });

  test('accepts Nº in the receiver name', () => {
    const result = pixSettingsSchema.safeParse({
      ...base,
      receiverName: 'Bloco Nº2',
      keyType: 'email',
      key: 'a@b.com',
    });

    expect(result.success).toBe(true);
  });
});
