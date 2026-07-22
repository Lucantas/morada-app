export type ProofBytes = { contentType: string; body: Uint8Array };

export interface ProofStorage {
  put(key: string, dataUrl: string): Promise<void>;
  get(key: string): Promise<ProofBytes | null>;
}

export type R2Config = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

const DATA_URL_PATTERN = /^data:([^;]+);base64,(.+)$/;

export function decodeDataUrl(dataUrl: string): ProofBytes {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  const contentType = match?.[1];
  const base64 = match?.[2];
  if (!contentType || !base64) {
    throw new Error('Invalid data URL — expected data:<content-type>;base64,<data>');
  }
  return { contentType, body: new Uint8Array(Buffer.from(base64, 'base64')) };
}
