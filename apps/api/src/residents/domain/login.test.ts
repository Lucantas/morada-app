import { deriveResidentLogin } from './login';

describe('deriveResidentLogin', () => {
  test('strips accents from the first name', () => {
    expect(deriveResidentLogin('Lúcia', 'Apto 303')).toBe('lucia303');
    expect(deriveResidentLogin('Rogério', '304')).toBe('rogerio304');
    expect(deriveResidentLogin('José', 'Apto 12')).toBe('jose12');
  });

  test('handles the ç cedilla', () => {
    expect(deriveResidentLogin('Conceição', 'Apto 201')).toBe('conceicao201');
  });

  test('uses only the first name of a compound name', () => {
    expect(deriveResidentLogin('Lúcia Ferreira', 'Apto 303')).toBe('lucia303');
    expect(deriveResidentLogin('José Antônio', 'Apto 12')).toBe('jose12');
  });

  test('extracts only the digits from the apartment label', () => {
    expect(deriveResidentLogin('Ana', 'Apto 303')).toBe('ana303');
    expect(deriveResidentLogin('Ana', '303')).toBe('ana303');
  });

  test('does not mutate its inputs', () => {
    const name = 'Lúcia Ferreira';
    const apt = 'Apto 303';

    deriveResidentLogin(name, apt);

    expect(name).toBe('Lúcia Ferreira');
    expect(apt).toBe('Apto 303');
  });
});
