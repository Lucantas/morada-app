import type { Street } from './street';

export interface StreetRepository {
  get(): Promise<Street>;
}
