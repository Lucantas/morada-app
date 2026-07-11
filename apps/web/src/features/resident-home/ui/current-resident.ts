export type CurrentResident = {
  name: string;
  apt: string;
  phone: string;
  email: string;
};

export const DEFAULT_RESIDENT: CurrentResident = {
  name: 'Maria Ribeiro',
  apt: 'Apto 302',
  phone: '(21) 99876-5432',
  email: 'maria.ribeiro@email.com',
};

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function residentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}
