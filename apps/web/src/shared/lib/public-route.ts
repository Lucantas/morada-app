const PUBLIC_ROUTE_KINDS = ['convite', 'confirmar-email', 'redefinir-senha'] as const;

export type PublicRouteKind = (typeof PUBLIC_ROUTE_KINDS)[number];
export type PublicRoute = { kind: PublicRouteKind; token: string };

const PUBLIC_ROUTE_PATTERN = /^#\/([a-z-]+)\/([A-Za-z0-9_-]{20,128})$/;

export function parsePublicRoute(hash: string): PublicRoute | null {
  const match = PUBLIC_ROUTE_PATTERN.exec(hash);
  if (!match) return null;
  const [, segment, token] = match;
  const kind = PUBLIC_ROUTE_KINDS.find((candidate) => candidate === segment);
  return kind && token ? { kind, token } : null;
}

export function clearPublicRoute(): void {
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, '', `${pathname}${search}`);
}
