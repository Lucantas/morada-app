import { createRepositories } from './repositories';

test('createRepositories builds a SQLite bundle and closes it', async () => {
  const { repos, close } = await createRepositories({ dbDriver: 'sqlite', dbPath: ':memory:' });
  expect(await repos.users.findByUsername('nobody')).toBeNull();
  await close();
});

test('createRepositories refuses the postgres driver without a DATABASE_URL', async () => {
  await expect(createRepositories({ dbDriver: 'postgres', dbPath: ':memory:' })).rejects.toThrow(
    /DATABASE_URL/,
  );
});
