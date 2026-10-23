import { ApiError, type ApiClient } from '@/shared/lib/api-client';
import { parseLoginResponse, type LoginResponse } from '@/features/session/domain/login-response';

import { InvitationError, type InvitationErrorKind } from '../domain/errors';
import {
  createdInvitationSchema,
  invitationPreviewSchema,
  invitationViewSchema,
  legacyLoginResetSchema,
  legacyLoginSchema,
  type AcceptInput,
  type CreatedInvitation,
  type InvitationPreview,
  type InvitationView,
  type LegacyLoginReset,
} from '../domain/invitation';
import type { InvitationRepository } from '../domain/invitation-repository';

const INACTIVE_RESIDENT = 'Morador inativo';

const SHARED_KINDS: Readonly<Record<number, InvitationErrorKind>> = {
  400: 'invalid-input',
  429: 'rate-limited',
  503: 'email-unavailable',
};

const ADMIN_KINDS: Readonly<Record<number, InvitationErrorKind>> = {
  ...SHARED_KINDS,
  404: 'not-found',
  409: 'pending-conflict',
};

const PUBLIC_KINDS: Readonly<Record<number, InvitationErrorKind>> = {
  ...SHARED_KINDS,
  401: 'invalid-credentials',
  404: 'invalid-invitation',
};

function toInvitationError(
  error: unknown,
  kinds: Readonly<Record<number, InvitationErrorKind>>,
): InvitationError {
  if (!(error instanceof ApiError)) return new InvitationError('unavailable');
  if (error.status === 409 && error.message === INACTIVE_RESIDENT) {
    return new InvitationError('inactive-resident');
  }
  return new InvitationError(kinds[error.status] ?? 'unavailable');
}

async function attempt<T>(
  run: () => Promise<T>,
  kinds: Readonly<Record<number, InvitationErrorKind>>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toInvitationError(error, kinds);
  }
}

const residentPath = (residentId: string) => `/api/residents/${encodeURIComponent(residentId)}`;
const tokenPath = (token: string) => `/auth/invitations/${encodeURIComponent(token)}`;

export class HttpInvitationRepository implements InvitationRepository {
  private readonly api: ApiClient;
  private readonly publicApi: ApiClient;

  constructor(clients: { api: ApiClient; publicApi: ApiClient }) {
    this.api = clients.api;
    this.publicApi = clients.publicApi;
  }

  invitation(residentId: string): Promise<InvitationView | null> {
    return attempt(
      async () =>
        invitationViewSchema
          .nullable()
          .parse(await this.api.get(`${residentPath(residentId)}/invitation`)),
      ADMIN_KINDS,
    );
  }

  invite(residentId: string, email: string): Promise<CreatedInvitation> {
    return attempt(
      async () =>
        createdInvitationSchema.parse(
          await this.api.post(`${residentPath(residentId)}/invitation`, { email }),
        ),
      ADMIN_KINDS,
    );
  }

  revoke(residentId: string): Promise<void> {
    return attempt(async () => {
      await this.api.post(`${residentPath(residentId)}/invitation/revoke`);
    }, ADMIN_KINDS);
  }

  legacyLogin(residentId: string): Promise<string | null> {
    return attempt(
      async () =>
        legacyLoginSchema.parse(await this.api.get(`${residentPath(residentId)}/login`)).username,
      ADMIN_KINDS,
    );
  }

  resetLegacyLogin(residentId: string): Promise<LegacyLoginReset> {
    return attempt(
      async () =>
        legacyLoginResetSchema.parse(
          await this.api.post(`${residentPath(residentId)}/login/reset`, {}),
        ),
      ADMIN_KINDS,
    );
  }

  preview(token: string): Promise<InvitationPreview> {
    return attempt(
      async () => invitationPreviewSchema.parse(await this.publicApi.get(tokenPath(token))),
      PUBLIC_KINDS,
    );
  }

  accept(token: string, input: AcceptInput): Promise<LoginResponse> {
    return attempt(
      async () =>
        parseLoginResponse(await this.publicApi.post(`${tokenPath(token)}/accept`, input)),
      PUBLIC_KINDS,
    );
  }
}
