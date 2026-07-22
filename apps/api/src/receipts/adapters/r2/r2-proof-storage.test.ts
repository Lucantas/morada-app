import { R2ProofStorage } from './r2-proof-storage';

describe('R2ProofStorage', () => {
  test('constructs without throwing given a valid config', () => {
    expect(
      () =>
        new R2ProofStorage({
          endpoint: 'https://example.r2.cloudflarestorage.com',
          accessKeyId: 'key-id',
          secretAccessKey: 'secret',
          bucket: 'proofs',
        }),
    ).not.toThrow();
  });
});
