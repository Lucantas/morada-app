import { pixInfoSchema, type PixInfo } from '../domain/pix-info';
import type { PixRepository } from '../domain/pix-repository';

export class InMemoryPixRepository implements PixRepository {
  private readonly current: PixInfo;

  constructor(initial: PixInfo) {
    this.current = pixInfoSchema.parse(initial);
  }

  async get(): Promise<PixInfo> {
    return this.current;
  }
}
