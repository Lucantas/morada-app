import { pixSettingsSchema } from './pix-key';

function parseKey(keyType: string, key: string) {
  return pixSettingsSchema.safeParse({ keyType, key, receiverName: 'Condomínio', city: 'Santos' });
}

function keyOf(keyType: string, key: string): string | undefined {
  const result = parseKey(keyType, key);
  return result.success ? result.data.key : undefined;
}

describe('pix key normalization', () => {
  test.each([
    ['cpf', '123.456.789-09', '12345678909'],
    ['cnpj', '11.222.333/0001-81', '11222333000181'],
    ['email', '  Maria@Example.COM ', 'maria@example.com'],
    ['telefone', '(11) 98888-7777', '+5511988887777'],
    ['telefone', '+55 11 98888-7777', '+5511988887777'],
    ['telefone', '(11) 3888-7777', '+551138887777'],
    ['aleatoria', '123E4567-E89B-12D3-A456-426614174000', '123e4567-e89b-12d3-a456-426614174000'],
  ])('normalizes %s %s', (keyType, raw, expected) => {
    expect(keyOf(keyType, raw)).toBe(expected);
  });

  test.each([
    ['cpf', '111.111.111-11'],
    ['cpf', '123.456.789-00'],
    ['cpf', '123'],
    ['cnpj', '11.222.333/0001-80'],
    ['cnpj', '11.111.111/1111-11'],
    ['email', 'sem-arroba'],
    ['email', `${'a'.repeat(70)}@example.com`],
    ['telefone', '12345'],
    ['telefone', '(11) 98888-77777777'],
    ['aleatoria', 'not-a-uuid'],
  ])('rejects %s %s', (keyType, raw) => {
    const result = parseKey(keyType, raw);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Chave Pix inválida');
  });

  test('rejects an unknown key type', () => {
    expect(parseKey('chave', 'x').success).toBe(false);
  });
});

describe('pix receiver and city', () => {
  test('trims the receiver name and the city', () => {
    const result = pixSettingsSchema.parse({
      keyType: 'cpf',
      key: '12345678909',
      receiverName: '  Condomínio Morada ',
      city: ' Santos  ',
    });

    expect(result).toEqual({
      keyType: 'cpf',
      key: '12345678909',
      receiverName: 'Condomínio Morada',
      city: 'Santos',
    });
  });

  test('rejects an empty or too long receiver name', () => {
    for (const receiverName of ['  ', 'x'.repeat(26)]) {
      const result = pixSettingsSchema.safeParse({
        keyType: 'cpf',
        key: '12345678909',
        receiverName,
        city: 'Santos',
      });
      expect(result.error?.issues[0]?.message).toBe(
        'Informe o nome do recebedor (até 25 caracteres)',
      );
    }
  });

  test('rejects an empty or too long city', () => {
    for (const city of ['', 'x'.repeat(16)]) {
      const result = pixSettingsSchema.safeParse({
        keyType: 'cpf',
        key: '12345678909',
        receiverName: 'Condomínio',
        city,
      });
      expect(result.error?.issues[0]?.message).toBe('Informe a cidade (até 15 caracteres)');
    }
  });
});
