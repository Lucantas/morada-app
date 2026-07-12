import bcrypt from 'bcryptjs';

import type { PasswordHasher } from '../../domain/password-hasher';

const DEFAULT_COST = 12;

export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly cost: number = DEFAULT_COST) {}

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.cost);
  }

  verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
