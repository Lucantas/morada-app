import { z } from 'zod';

import {
  createdInvitationSchema,
  type CreatedInvitation,
} from '@/features/invitations/domain/invitation';
import { ApiError, type ApiClient } from '@/shared/lib/api-client';
import type { OrgRole } from '@/shared/lib/permissions';

import { TeamError } from '../domain/errors';
import { teamSchema, type Team } from '../domain/team';
import type { TeamRepository } from '../domain/team-repository';

const CONNECTION = 'Não foi possível concluir. Verifique a conexão com o servidor.';
const NO_ORGANIZATION = 'Nenhuma organização selecionada';

const FRIENDLY: Readonly<Record<number, string>> = {
  429: 'Muitas tentativas, tente mais tarde.',
  503: 'Envio de e-mail indisponível. Tente mais tarde.',
};
const SERVER_MESSAGE_STATUSES: ReadonlySet<number> = new Set([400, 404, 409]);

const renameResponseSchema = z.object({ id: z.string(), name: z.string() });
const assignResponseSchema = z.object({ condoIds: z.array(z.string()) });

function toTeamError(error: unknown): TeamError {
  if (error instanceof TeamError) return error;
  if (error instanceof ApiError) {
    const friendly = FRIENDLY[error.status];
    if (friendly) return new TeamError(friendly);
    if (SERVER_MESSAGE_STATUSES.has(error.status)) return new TeamError(error.message);
  }
  return new TeamError(CONNECTION);
}

export class HttpTeamRepository implements TeamRepository {
  constructor(
    private readonly api: ApiClient,
    private readonly orgId: () => string | null,
  ) {}

  private base(): string {
    const id = this.orgId();
    if (!id) throw new TeamError(NO_ORGANIZATION);
    return `/api/orgs/${id}`;
  }

  private async run<T>(call: (base: string) => Promise<T>): Promise<T> {
    try {
      return await call(this.base());
    } catch (error) {
      throw toTeamError(error);
    }
  }

  get(): Promise<Team> {
    return this.run(async (base) => teamSchema.parse(await this.api.get(base)));
  }

  async rename(name: string): Promise<void> {
    await this.run(async (base) => renameResponseSchema.parse(await this.api.put(base, { name })));
  }

  invite(email: string, orgRole: OrgRole, phone?: string): Promise<CreatedInvitation> {
    return this.run(async (base) =>
      createdInvitationSchema.parse(
        await this.api.post(`${base}/invitations`, { email, orgRole, ...(phone ? { phone } : {}) }),
      ),
    );
  }

  async revokeInvitation(invitationId: string): Promise<void> {
    await this.run((base) => this.api.post(`${base}/invitations/${invitationId}/revoke`));
  }

  async deactivateMember(userId: string): Promise<void> {
    await this.run((base) => this.api.post(`${base}/members/${userId}/deactivate`));
  }

  async assignCondos(userId: string, condoIds: readonly string[]): Promise<void> {
    await this.run(async (base) =>
      assignResponseSchema.parse(
        await this.api.put(`${base}/members/${userId}/condos`, { condoIds }),
      ),
    );
  }
}
