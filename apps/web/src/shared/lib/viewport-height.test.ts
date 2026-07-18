import { trackAppHeight } from './viewport-height';

describe('trackAppHeight', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--app-height');
  });

  test('sets --app-height from the current innerHeight', () => {
    window.innerHeight = 640;
    const stop = trackAppHeight();
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('640px');
    stop();
  });

  test('updates --app-height when the viewport resizes', () => {
    window.innerHeight = 640;
    const stop = trackAppHeight();
    window.innerHeight = 720;
    window.dispatchEvent(new Event('resize'));
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('720px');
    stop();
  });

  test('stops updating after cleanup', () => {
    window.innerHeight = 640;
    const stop = trackAppHeight();
    stop();
    window.innerHeight = 900;
    window.dispatchEvent(new Event('resize'));
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('640px');
  });
});
