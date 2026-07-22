export function readCookie(name: string): string | null {
  const target = `${name}=`;
  const found = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(target));
  return found ? decodeURIComponent(found.slice(target.length)) : null;
}
