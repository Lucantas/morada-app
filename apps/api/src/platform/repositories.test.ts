import { config } from './config';
import { createRepositories } from './repositories';

test('createRepositories connects to Postgres, migrates and closes', async () => {
  const { repos, close } = await createRepositories({ databaseUrl: config.databaseUrl });
  expect(await repos.users.findByUsername('nobody')).toBeNull();
  await close();
});
