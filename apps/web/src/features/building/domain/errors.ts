export type BuildingErrorKind = 'not_found' | 'conflict' | 'invalid' | 'unavailable';

export class BuildingError extends Error {
  constructor(
    readonly kind: BuildingErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'BuildingError';
  }
}
