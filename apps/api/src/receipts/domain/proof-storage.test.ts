import { decodeDataUrl } from './proof-storage';

describe('decodeDataUrl', () => {
  test('splits content-type and bytes', () => {
    const { contentType, body } = decodeDataUrl(
      'data:image/png;base64,' + Buffer.from('hi').toString('base64'),
    );
    expect(contentType).toBe('image/png');
    expect(Buffer.from(body).toString()).toBe('hi');
  });

  test('rejects a non-data-url', () => {
    expect(() => decodeDataUrl('nope')).toThrow();
  });
});
