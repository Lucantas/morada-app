import type { LoginCondo, LoginResponse } from '@/features/session/domain/login-response';

import type { SignUpInput } from './account-schemas';

export interface UserAccountRepository {
  login(login: string, password: string): Promise<LoginResponse>;
  signUp(input: SignUpInput): Promise<void>;
  confirmEmail(token: string, password: string): Promise<LoginResponse>;
  resendConfirmation(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, password: string): Promise<LoginResponse>;
  createCondo(name: string): Promise<LoginCondo>;
}
