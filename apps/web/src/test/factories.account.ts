import type { UserAccountRepository } from '@/features/account/domain/account-repository';
import type { LoginResponse } from '@/features/session/domain/login-response';

export const ADMIN_LOGIN: LoginResponse = {
  condos: [{ id: 'c1', name: 'Morada', role: 'admin' }],
  emailVerified: true,
};

export function fakeUserAccountRepository(
  overrides: Partial<UserAccountRepository> = {},
): jest.Mocked<UserAccountRepository> {
  return {
    login: jest.fn().mockResolvedValue(ADMIN_LOGIN),
    signUp: jest.fn().mockResolvedValue(undefined),
    confirmEmail: jest.fn().mockResolvedValue(ADMIN_LOGIN),
    resendConfirmation: jest.fn().mockResolvedValue(undefined),
    requestPasswordReset: jest.fn().mockResolvedValue(undefined),
    resetPassword: jest.fn().mockResolvedValue(ADMIN_LOGIN),
    createCondo: jest.fn().mockResolvedValue({ id: 'c9', name: 'Edifício Sol', role: 'admin' }),
    ...overrides,
  } as jest.Mocked<UserAccountRepository>;
}
