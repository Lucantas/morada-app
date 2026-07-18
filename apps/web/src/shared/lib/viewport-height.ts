export function trackAppHeight(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const apply = () => {
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
  };

  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);

  return () => {
    window.removeEventListener('resize', apply);
    window.removeEventListener('orientationchange', apply);
  };
}
