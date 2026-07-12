import type { Role } from './session';

type DemoLogin = { password: string; role: Role; subject: string };

const DEMO_LOGINS: Record<string, DemoLogin> = {
  admin: { password: 'morada-admin', role: 'admin', subject: 'u-admin' },
  maria302: { password: 'morada-demo', role: 'resident', subject: 'r-1' },
};

export function resolveDemoLogin(
  username: string,
  password: string,
): { role: Role; subject: string } | null {
  const entry = DEMO_LOGINS[username];
  if (!entry || entry.password !== password) return null;
  return { role: entry.role, subject: entry.subject };
}
