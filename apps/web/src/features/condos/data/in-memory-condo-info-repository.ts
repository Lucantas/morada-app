import { condoInfoSchema, condoNameSchema, type CondoInfo } from '../domain/condo-info';
import type { CondoInfoRepository } from '../domain/condo-info-repository';

export class InMemoryCondoInfoRepository implements CondoInfoRepository {
  private current: CondoInfo;

  constructor(initial: CondoInfo) {
    this.current = condoInfoSchema.parse(initial);
  }

  async get(): Promise<CondoInfo> {
    return this.current;
  }

  async rename(name: string): Promise<CondoInfo> {
    this.current = { ...this.current, name: condoNameSchema.parse(name) };
    return this.current;
  }

  snapshot(): CondoInfo {
    return this.current;
  }
}
