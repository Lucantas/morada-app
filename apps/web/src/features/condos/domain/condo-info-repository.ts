import type { CondoInfo } from './condo-info';

export interface CondoInfoRepository {
  get(): Promise<CondoInfo>;
  rename(name: string): Promise<CondoInfo>;
}
