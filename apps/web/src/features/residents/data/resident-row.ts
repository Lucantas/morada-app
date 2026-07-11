import { residentSchema, type Resident } from '../domain/resident';

/** Parses untrusted seed/API data into a domain Resident. Raw rows never leak up. */
export function toResident(raw: unknown): Resident {
  return residentSchema.parse(raw);
}
