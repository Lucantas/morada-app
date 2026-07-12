import type { User } from './user';

export interface UserRepository {
  findByUsername(username: string): User | null;
  existsByUsername(username: string): boolean;
  existsByResidentId(residentId: string): boolean;
  save(user: User): User;
}
