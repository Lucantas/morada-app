type ResidentProfile = {
  name: string;
  apt: string;
  phone: string;
  email: string;
};

export function buildCurrentResident(overrides: Partial<ResidentProfile> = {}): ResidentProfile {
  return {
    name: 'Maria Ribeiro',
    apt: 'Apto 302',
    phone: '(21) 99876-5432',
    email: 'maria.ribeiro@email.com',
    ...overrides,
  };
}
