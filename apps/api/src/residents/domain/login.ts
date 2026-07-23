export function deriveResidentLogin(name: string, apt: string): string {
  const firstName = name.trim().split(/\s+/)[0] ?? '';
  const normalizedFirstName = firstName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  const aptDigits = apt.replace(/\D/g, '');
  return `${normalizedFirstName}${aptDigits}`;
}
