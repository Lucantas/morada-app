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
  markEmailVerifiedAndBump(
    id: string,
    at: Date,
    expectedPasswordHash: string,
  ): Promise<number | null>;
  setPasswordHashAndBump(id: string, passwordHash: string): Promise<number>;
  updateCredentialsAndBump(
    id: string,
    credentials: { name: string; passwordHash: string },
  ): Promise<number>;
  sessionVersionOf(id: string): Promise<number | null>;
  save(user: User): Promise<User>;
}
