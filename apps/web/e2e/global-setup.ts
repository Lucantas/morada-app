import { ensureE2eDatabaseExists } from './ensure-e2e-db';

export default async function globalSetup(): Promise<void> {
  await ensureE2eDatabaseExists();
}
