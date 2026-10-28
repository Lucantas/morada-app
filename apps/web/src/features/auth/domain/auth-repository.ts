import type { LoginCondo, LoginResponse } from '@/features/session/domain/login-response';

import type { CreateCondoInput } from '@/features/condos/domain/create-condo';

import type { SignUpInput } from './auth-schemas';

export interface AuthRepository {
  login(login: string, password: string): Promise<LoginResponse>;
  signUp(input: SignUpInput): Promise<void>;
  confirmEmail(token: string, password: string): Promise<LoginResponse>;
  resendConfirmation(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, password: string): Promise<LoginResponse>;
  createCondo(input: CreateCondoInput): Promise<LoginCondo>;
}
