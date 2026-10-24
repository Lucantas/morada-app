import type { PixInfo } from './pix-info';

export interface PixRepository {
  get(): Promise<PixInfo>;
}
