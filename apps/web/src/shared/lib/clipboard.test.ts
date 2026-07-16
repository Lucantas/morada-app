import { copyText } from './clipboard';

describe('copyText', () => {
  test('writes the given text to the clipboard', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    await copyText('7Kq2Ab9m');

    expect(writeText).toHaveBeenCalledWith('7Kq2Ab9m');
  });
});
