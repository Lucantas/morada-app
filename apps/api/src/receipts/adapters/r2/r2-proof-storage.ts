import { S3Client, PutObjectCommand, GetObjectCommand, NoSuchKey } from '@aws-sdk/client-s3';
import type { ProofStorage, ProofBytes, R2Config } from '../../domain/proof-storage';
import { decodeDataUrl } from '../../domain/proof-storage';

export class R2ProofStorage implements ProofStorage {
  private readonly client: S3Client;

  constructor(private readonly cfg: R2Config) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: cfg.endpoint,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }

  async put(key: string, dataUrl: string): Promise<void> {
    const { contentType, body } = decodeDataUrl(dataUrl);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string): Promise<ProofBytes | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }),
      );
      if (!res.Body) return null;
      const body = new Uint8Array(await res.Body.transformToByteArray());
      return { contentType: res.ContentType ?? 'application/octet-stream', body };
    } catch (error) {
      if (error instanceof NoSuchKey) return null;
      throw error;
    }
  }
}
