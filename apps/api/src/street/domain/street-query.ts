import type { StreetFacts } from './street';

export interface StreetQuery {
  factsFor(
    condoIds: readonly string[],
    viewerUserId: string,
    today: string,
  ): Promise<Map<string, StreetFacts>>;
}
