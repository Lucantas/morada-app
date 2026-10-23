import type { AuthRepository } from '@/features/auth/domain/auth-repository';
import type { LoginCondo, LoginResponse } from '@/features/session/domain/login-response';

export const ADMIN_LOGIN: LoginResponse = {
  condos: [{ id: 'c1', name: 'Morada', role: 'admin' }],
  emailVerified: true,
};

export const CREATED_CONDO: LoginCondo = { id: 'c9', name: 'Edifício Sol', role: 'admin' };

type MockOf<F extends (...args: never[]) => unknown> = jest.Mock<ReturnType<F>, Parameters<F>>;

export type FakeAuthRepository = { [K in keyof AuthRepository]: MockOf<AuthRepository[K]> };

export function fakeAuthRepository(
  overrides: Partial<FakeAuthRepository> = {},
): FakeAuthRepository {
  const repository = {
    login: jest.fn<Promise<LoginResponse>, [string, string]>().mockResolvedValue(ADMIN_LOGIN),
    signUp: jest.fn<Promise<void>, Parameters<AuthRepository['signUp']>>().mockResolvedValue(),
    confirmEmail: jest
      .fn<Promise<LoginResponse>, [string, string]>()
      .mockResolvedValue(ADMIN_LOGIN),
    resendConfirmation: jest.fn<Promise<void>, []>().mockResolvedValue(),
    requestPasswordReset: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
    resetPassword: jest
      .fn<Promise<LoginResponse>, [string, string]>()
      .mockResolvedValue(ADMIN_LOGIN),
    createCondo: jest.fn<Promise<LoginCondo>, [string]>().mockResolvedValue(CREATED_CONDO),
  } satisfies FakeAuthRepository;
  return { ...repository, ...overrides };
}
