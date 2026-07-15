import { isAllowedProof } from './proof';

describe('isAllowedProof', () => {
  it('accepts image and pdf data urls, rejects others', () => {
    expect(isAllowedProof('data:image/png;base64,aaa')).toBe(true);
    expect(isAllowedProof('data:application/pdf;base64,aaa')).toBe(true);
    expect(isAllowedProof('data:text/plain;base64,aaa')).toBe(false);
    expect(isAllowedProof('nope')).toBe(false);
  });
});
