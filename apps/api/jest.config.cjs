// Keep bcrypt cheap under test so the credential suite stays fast; production
// uses the strong default cost from config.
process.env.BCRYPT_COST = process.env.BCRYPT_COST || '4';

// The suite runs against a live Postgres (DATABASE_URL) and shares one database,
// so tests run serially and reset between cases.
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  maxWorkers: 1,
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'commonjs', verbatimModuleSyntax: false } }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/migrate-main.ts',
    '!src/**/*.d.ts',
    '!src/**/*.contract.ts',
    '!src/test-support/**',
    '!src/platform/postgres/migrations.ts',
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};
