import type { User } from './user';

export interface UserRepository {
  findByUsername(username: string): Promise<User | null>;
  findByResidentId(residentId: string): Promise<User | null>;
  existsByUsername(username: string): Promise<boolean>;
  existsByResidentId(residentId: string): Promise<boolean>;
  hasAny(): Promise<boolean>;
  save(user: User): Promise<User>;
}
