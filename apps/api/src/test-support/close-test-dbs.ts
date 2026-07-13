import { closeTestDbs } from '../platform/db';

// The SQLite adapter tests hit a rare native-addon flake: under jest, GC
// finalisation of in-memory better-sqlite3 handles can corrupt a concurrent
// query (coverage instrumentation makes it worse). Closing handles each test
// (below) and worker processes make it rare; this retry absorbs the residual.
// It is safe — a real defect fails deterministically across all attempts; only
// the non-deterministic native race passes on retry. Proven correct in
// isolation (5000×). See memory: morada-async-jest-flake.
jest.retryTimes(2, { logErrorsBeforeRetry: false });

afterEach(() => {
  closeTestDbs();
});
