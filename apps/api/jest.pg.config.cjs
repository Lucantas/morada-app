// Keep bcrypt cheap under test so the credential suite stays fast; production
// uses the strong default cost from config.
process.env.BCRYPT_COST = process.env.BCRYPT_COST || '4';

// Postgres adapter tests: run serially (a single shared database) against a live
// Postgres reached via DATABASE_URL. The everyday SQLite gate lives in
// jest.config.cjs; this config runs only the *.pg.test.ts files.
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testMatch: ['<rootDir>/src/**/*.pg.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'commonjs', verbatimModuleSyntax: false } }],
  },
  collectCoverageFrom: [
    'src/**/adapters/postgres/**/*.ts',
    'src/platform/postgres/pool.ts',
    'src/platform/postgres/migrate.ts',
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};
