import type { User } from './user';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByResidentId(residentId: string): Promise<User | null>;
  existsByEmail(email: string): Promise<boolean>;
  existsByUsername(username: string): Promise<boolean>;
  existsByResidentId(residentId: string): Promise<boolean>;
  hasAny(): Promise<boolean>;
  markEmailVerified(id: string, at: Date): Promise<void>;
  setPasswordHash(id: string, passwordHash: string): Promise<void>;
  updateCredentials(id: string, credentials: { name: string; passwordHash: string }): Promise<void>;
  bumpSessionVersion(id: string): Promise<number>;
  save(user: User): Promise<User>;
}
