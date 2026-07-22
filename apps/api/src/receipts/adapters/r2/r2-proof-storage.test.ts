import { S3Client, NoSuchKey } from '@aws-sdk/client-s3';

import { R2ProofStorage } from './r2-proof-storage';

const CONFIG = {
  endpoint: 'https://example.r2.cloudflarestorage.com',
  accessKeyId: 'key-id',
  secretAccessKey: 'secret',
  bucket: 'proofs',
};

describe('R2ProofStorage', () => {
  test('constructs without throwing given a valid config', () => {
    expect(() => new R2ProofStorage(CONFIG)).not.toThrow();
  });

  describe('get', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('returns contentType + bytes when the object is found', async () => {
      const storage = new R2ProofStorage(CONFIG);
      jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({
        ContentType: 'image/png',
        Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
      } as never);

      const result = await storage.get('receipts/rc-1');

      expect(result).toEqual({ contentType: 'image/png', body: new Uint8Array([1, 2, 3]) });
    });

    test('returns null when the object does not exist (NoSuchKey)', async () => {
      const storage = new R2ProofStorage(CONFIG);
      jest
        .spyOn(S3Client.prototype, 'send')
        .mockRejectedValue(new NoSuchKey({ message: 'not found', $metadata: {} }) as never);

      expect(await storage.get('receipts/missing')).toBeNull();
    });

    test('returns null when the response has no Body', async () => {
      const storage = new R2ProofStorage(CONFIG);
      jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({
        ContentType: 'image/png',
        Body: undefined,
      } as never);

      expect(await storage.get('receipts/rc-1')).toBeNull();
    });
  });
});
