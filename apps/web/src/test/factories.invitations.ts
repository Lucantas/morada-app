import type {
  CreatedInvitation,
  InvitationPreview,
  InvitationView,
  LegacyLoginReset,
  SindicoView,
} from '@/features/invitations/domain/invitation';
import type { InvitationRepository } from '@/features/invitations/domain/invitation-repository';
import type { LoginResponse } from '@/features/session/domain/login-response';

import { loginCondo } from './factories.auth';

export const PENDING_INVITATION: InvitationView = {
  status: 'pendente',
  email: 'ana@exemplo.com',
  expiresAt: '2026-10-30T15:00:00.000Z',
};

export const CREATED_INVITATION: CreatedInvitation = {
  ...PENDING_INVITATION,
  link: 'https://morada.app/#/convite/abcDEF0123456789_-xyz',
  whatsappUrl: 'https://wa.me/5521999990000?text=convite',
  emailSent: true,
};

export const OPEN_PREVIEW: InvitationPreview = {
  role: 'morador',
  targetName: 'Condomínio Morada',
  condoName: 'Condomínio Morada',
  residentName: 'Ana Souza',
  apt: 'Apto 302',
  email: null,
  accountExists: false,
};

export const SINDICO_PREVIEW: InvitationPreview = {
  role: 'sindico',
  targetName: 'Condomínio Morada',
  condoName: 'Condomínio Morada',
  email: 'sindico@exemplo.com',
  accountExists: false,
};

export const TEAM_PREVIEW: InvitationPreview = {
  role: 'membro',
  targetName: 'Administradora Aurora',
  email: 'equipe@exemplo.com',
  accountExists: true,
};

export const EMPTY_SINDICO: SindicoView = { current: null, invitation: null };

export const CURRENT_SINDICO: SindicoView = {
  current: { name: 'Carla Lima', email: 'carla@exemplo.com' },
  invitation: null,
};

export const PENDING_SINDICO: SindicoView = {
  current: null,
  invitation: PENDING_INVITATION,
};

export const RESIDENT_LOGIN: LoginResponse = {
  condos: [
    loginCondo({
      id: 'c1',
      name: 'Condomínio Morada',
      role: 'resident',
      condoRole: 'morador',
      permissions: [],
    }),
  ],
  emailVerified: true,
};

type MockOf<F extends (...args: never[]) => unknown> = jest.Mock<ReturnType<F>, Parameters<F>>;

export type FakeInvitationRepository = {
  [K in keyof InvitationRepository]: MockOf<InvitationRepository[K]>;
};

export function fakeInvitationRepository(
  overrides: Partial<FakeInvitationRepository> = {},
): FakeInvitationRepository {
  const repository = {
    invitation: jest.fn<Promise<InvitationView | null>, [string]>().mockResolvedValue(null),
    invite: jest
      .fn<Promise<CreatedInvitation>, [string, string]>()
      .mockResolvedValue(CREATED_INVITATION),
    revoke: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
    legacyLogin: jest.fn<Promise<string | null>, [string]>().mockResolvedValue(null),
    resetLegacyLogin: jest
      .fn<Promise<LegacyLoginReset>, [string]>()
      .mockResolvedValue({ username: 'ana302', tempPassword: 'Temp1234' }),
    sindico: jest.fn<Promise<SindicoView>, []>().mockResolvedValue(EMPTY_SINDICO),
    inviteSindico: jest
      .fn<Promise<CreatedInvitation>, [string, (string | undefined)?]>()
      .mockResolvedValue(CREATED_INVITATION),
    revokeSindico: jest.fn<Promise<void>, []>().mockResolvedValue(),
    removeSindico: jest.fn<Promise<void>, []>().mockResolvedValue(),
    preview: jest.fn<Promise<InvitationPreview>, [string]>().mockResolvedValue(OPEN_PREVIEW),
    accept: jest
      .fn<Promise<LoginResponse>, Parameters<InvitationRepository['accept']>>()
      .mockResolvedValue(RESIDENT_LOGIN),
  } satisfies FakeInvitationRepository;
  return { ...repository, ...overrides };
}
