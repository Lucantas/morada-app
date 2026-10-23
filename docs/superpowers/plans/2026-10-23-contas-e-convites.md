# Contas e convites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everyone logs in with e-mail + password: open sign-up with e-mail confirmation, password reset, resident invitations by link (WhatsApp / e-mail / copy), a minimal "create your condominium" step, and the end of new derived logins.

**Architecture:** The `users` feature (API) grows into the identity feature: `User` gains `email`/`name`/`emailVerifiedAt`, single-use tokens (`auth_tokens`) back e-mail confirmation and password reset, and a new `invitations` feature owns resident invites. An `EmailSender` port lives in `platform/email` with an in-memory adapter (dev/test) and a Cloudflare Email Sending REST adapter (prod). Public flows live under `/auth/*` (no session); admin invite actions live under `/api/condos/:condoId/residents/:id/invitation`. The web opens invite/confirm/reset links through hash routes (`/#/convite/<token>`), so tokens never reach server logs or the Pages router.

**Tech Stack:** Hono, node-pg, Zod, Jest (API, `morada_test`), Vite + React 19, Zustand, TanStack Query, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-22-morada-saas-multi-condominio-design.md` (sections 5, 8.1, 8.2, 8.2.1, 8.3, 11 item 2, 12, 14)

## Global Constraints

- Login entity stays named `User` (spec §14 lets the builder pick `User` vs `UserAccount`); never `Account`.
- Every commit carries the trailer `Spec: docs/superpowers/specs/2026-10-22-morada-saas-multi-condominio-design.md`. Never `--no-verify`.
- TDD: failing test first, in the same commit. Coverage ≥ 80% (API and web gates). No `any`, no `!`, no `console.*`, no code comments.
- Zod at every boundary. E-mails are normalized `trim().toLowerCase()` and validated with `z.string().email().max(160)`.
- Passwords: `z.string().min(8).max(200)`. Names: `z.string().trim().min(1).max(120)`.
- Tokens: 32 random bytes, base64url, stored only as SHA-256 hex. Single use.
- TTLs (exact): e-mail confirmation 24 h; password reset 1 h; invitation 7 days.
- Nothing is hard-deleted: invitations change `status`, grants flip `active`.
- Cross-condo resources answer 404. Public token endpoints answer 404 `"Convite inválido ou expirado"` / `"Link inválido ou expirado"` for unknown, expired, used or revoked tokens alike.
- Copy is PT-BR. E-mail subjects (exact): `"Confirme seu e-mail no Morada"`, `"Redefinição de senha do Morada"`, `"Você foi convidado para o <condomínio>"`.
- Mobile-first screens; desktop is an extension, no phone frame.
- Migrations are append-only in `apps/api/src/platform/postgres/migrations.ts`; the next id is `019_…`.
- Tests never touch the `morada` DB. Run `make e2e` before pushing login/invite/apartment UI changes.

## Decisions (mine, for Lucas to check)

- `POST /auth/signup` never reveals whether an e-mail exists: it always answers 202. If the e-mail is taken, the owner gets a "someone tried to sign up with your e-mail" message with a reset link instead of a confirmation link. Sign-up does not log in; the confirmation link does.
- An unconfirmed account can log in, but sees only "Confirme seu e-mail" (resend button). It holds no grants, so it reaches nothing.
- A legacy username login with zero active condos is still rejected as invalid credentials (moved-out resident). A zero-condo login is allowed only for e-mail accounts.
- Until SP4 (onboarding conversation), a confirmed user with no condominium sees a minimal "Que condomínio vamos gerenciar hoje?" screen with only the name field. It creates an organization (or reuses the one the user already owns), the condominium (fee 0, due day 10), and the `administrador` grant.
- SP2 invites only `morador` (tied to a resident record). Síndico and team invites are SP3.
- An invitation token is shown once, at creation. "Reenviar" issues a new token and revokes the previous one; the admin cannot copy an old link later.
- Accepting a resident invitation deactivates that resident's legacy derived-login grant in that condominium. The legacy login stops working there the moment the e-mail account takes over.
- New derived logins can no longer be provisioned (`POST /api/condos/:id/users` is removed). Existing legacy logins keep working and keep "Redefinir senha" until migrated. An explicit admin "retire legacy login" action is deferred.
- Password reset also confirms the e-mail, since it proves the same possession. Existing sessions (stateless JWT, 8 h) are not revoked by a reset. Deferred.
- In production without e-mail credentials, the API still starts and uses a disabled sender. Every send fails with 503 `"Envio de e-mail indisponível"`, and invites still work via WhatsApp / copy link. DEPLOY.md lists the three secrets.
- Links point to `APP_URL` (env), defaulting to the first `WEB_ORIGIN`.

## Review Focus

1. **Invite link forwarded to a stranger after acceptance:** the second opener gets 404 `"Convite inválido ou expirado"`, and nothing is granted (Task 7 test `accept is single use`).
2. **E-mail invite opened by someone already holding an account with that e-mail:** they must enter that account's password. A wrong password answers 401 and does not consume the invite (Task 7 test `existing account must authenticate`).
3. **E-mail typed with spaces or capitals (`" Ana@X.com "`)** at sign-up, login, forgot or invite: it is treated as `ana@x.com` everywhere (Task 1 test `email is normalized`, Task 3 test `login by email ignores case`).
4. **An admin of condo A invites or revokes for a resident of condo B:** 404, no row written (Task 6 test `foreign resident is 404`).
5. **WhatsApp-only invite claimed by a new, unconfirmed account:** the grant appears only after the confirmation link is opened, even if the invite has expired meanwhile. Another account cannot claim the same invite (Task 7 tests `claim activates on confirmation` and `claimed invite cannot be claimed again`).

---

### Task 1: Identity schema — users get e-mail, name and verification

**Files:**

- Modify: `apps/api/src/platform/postgres/migrations.ts` (append `019_identity`)
- Modify: `apps/api/src/users/domain/user.ts`, `users/domain/user-repository.ts`, `users/adapters/postgres/user-repository.ts`, `users/adapters/user-repository.contract.ts`, `users/adapters/postgres/user-repository.test.ts`
- Modify: callers that build `User` literals (`seed-data.ts`, `users/app/create-resident-login.ts`, test fixtures)
- Create: `apps/api/src/users/domain/email.ts` (+ `email.test.ts`)

**Interfaces:**

- Produces: `emailSchema` (normalizing) and `normalizeEmail(raw: string): string` in `users/domain/email.ts`.
- Produces: `User = { id; username: string | null; email: string | null; name: string | null; passwordHash; role: 'admin' | 'resident'; residentId: string | null; emailVerifiedAt: Date | null }`.
- Produces: `UserRepository` additions: `findById(id): Promise<User | null>`, `findByEmail(email): Promise<User | null>` (expects a normalized e-mail), `existsByEmail(email): Promise<boolean>`, `markEmailVerified(id, at: Date): Promise<void>`, `setPasswordHash(id, hash): Promise<void>`.

- [ ] **Step 1: Write failing tests.**
  - `email.test.ts`: `email is normalized` (`normalizeEmail(' Ana@X.com ')` → `'ana@x.com'`; `emailSchema.parse(' Ana@X.com ')` → `'ana@x.com'`). Rejects `'ana'` and a 161-character address.
  - Contract tests:
    - `findByEmail` returns the user saved with that e-mail.
    - `existsByEmail` is true/false.
    - `markEmailVerified` sets `emailVerifiedAt`.
    - `setPasswordHash` replaces the hash.
    - Saving a second user with the same e-mail rejects with `EmailTakenError` (status 409).
    - A user with `username: null` round-trips.
- [ ] **Step 2: Run `make api-test`.** Expect the new tests to FAIL.
- [ ] **Step 3: Append migration `019_identity`.**
  - `ALTER TABLE users ALTER COLUMN username DROP NOT NULL`.
  - `ADD COLUMN email TEXT`, `ADD COLUMN name TEXT`, `ADD COLUMN email_verified_at TIMESTAMPTZ`.
  - `CREATE UNIQUE INDEX idx_users_email ON users (email) WHERE email IS NOT NULL`.
- [ ] **Step 4: Implement the schema and repository changes.**
  - `userSchema` gets `username: usernameSchema.nullable()`, `email: emailSchema.nullable()`, `name: z.string().trim().min(1).max(120).nullable()`, `emailVerifiedAt: z.date().nullable()`.
  - Add `EmailTakenError` to `users/domain/errors.ts`; the Postgres `save` maps unique violation `23505` on `idx_users_email` to it.
  - Update every `User` literal with `email: null, name: null, emailVerifiedAt: null`.
- [ ] **Step 5: Run `make api-check`.** Expect PASS.
- [ ] **Step 6: Commit.** `feat(users): e-mail, name and verification on users`

### Task 2: Platform — e-mail port, tokens, app URL

**Files:**

- Create: `apps/api/src/platform/email/email-sender.ts`, `in-memory-email-sender.ts`, `cloudflare-email-sender.ts`, `disabled-email-sender.ts`, `email-sender.test.ts`, `cloudflare-email-sender.test.ts`
- Create: `apps/api/src/platform/tokens.ts` (+ test)
- Modify: `apps/api/src/platform/config.ts` (+ test)

**Interfaces:**

- Produces: `interface EmailMessage { to: string; subject: string; text: string; html: string }` and `interface EmailSender { send(message: EmailMessage): Promise<void> }`.
- Produces: `class InMemoryEmailSender implements EmailSender { readonly sent: readonly EmailMessage[]; lastTo(to: string): EmailMessage | undefined }`.
- Produces: `class DisabledEmailSender` (every `send` throws `EmailUnavailableError`, status 503, message `"Envio de e-mail indisponível"`) and `EmailDeliveryError` (status 502, message `"Não foi possível enviar o e-mail"`).
- Produces: `class CloudflareEmailSender(cfg: { accountId; apiToken; from: string; fetchFn?: typeof fetch })`.
- Produces: `generateToken(): string` (32 bytes, base64url), `hashToken(token: string): string` (sha256 hex).
- Produces: `config.appUrl: string`, `config.email: { accountId; apiToken; from } | null`, parsed by `parseEmailConfig(env)` and `parseAppUrl(raw, webOrigins)`.

- [ ] **Step 1: Write failing tests.**
  - The Cloudflare adapter POSTs to `https://api.cloudflare.com/client/v4/accounts/<accountId>/email/sending/send`:
    - headers `Authorization: Bearer <apiToken>`, `Content-Type: application/json`;
    - body `{ to, from: { address: <from>, name: 'Morada' }, subject, html, text }`;
    - a non-2xx response throws `EmailDeliveryError`.
  - The in-memory sender records messages, and `lastTo` finds the latest one per recipient.
  - `generateToken()` returns 43 base64url characters, and two calls differ. `hashToken` is deterministic, 64 hex characters.
  - `parseEmailConfig` needs all three of `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_EMAIL_API_TOKEN`, `EMAIL_FROM`, else returns `null`. `parseAppUrl(undefined, ['https://a'])` → `'https://a'`; a trailing `/` is stripped.
- [ ] **Step 2: Run `make api-test`.** Expect FAIL.
- [ ] **Step 3: Implement the files above.**
- [ ] **Step 4: Run `make api-check`.** Expect PASS.
- [ ] **Step 5: Commit.** `feat(platform): e-mail sender port, token helpers and app URL`

### Task 3: Login by e-mail and the account state

**Files:**

- Modify: `apps/api/src/users/app/verify-credentials.ts` (+ test), `users/adapters/http/auth-routes.ts`, `condos/adapters/http/routes.ts` (`meRoutes`), `compose.ts`, `compose.test.ts`

**Interfaces:**

- Consumes: Task 1 `UserRepository.findByEmail`, `normalizeEmail`.
- Produces: `verifyCredentials(repo, hasher, login: string, password)`. A login containing `@` is looked up by normalized e-mail, otherwise by username.
- Produces: `POST /auth/login` body `{ login: string (1..160), password }`.
  - Response 200: `{ condos: CondoSummary[], emailVerified: boolean }`. `emailVerified` is `true` for legacy username users without an e-mail.
  - Body key `username` is still accepted as an alias of `login` during the transition.
- Produces: `GET /me` → `{ id, name, email, emailVerified, condos }` (authenticated, outside `/api`).
- Produces: `sessionResponse(c, user, condos)` helper in `users/adapters/http/session-cookies.ts`. It sets the session + CSRF cookies and returns the JSON above; Tasks 4, 5 and 7 reuse it.

- [ ] **Step 1: Write failing tests.**
  - `login by email ignores case`: login `' ANA@x.com '` works.
  - An e-mail account with zero condos logs in → `{ condos: [], emailVerified: false }`.
  - A legacy username user with zero condos still gets 401.
  - `GET /me` returns the shape above.
  - The existing username login keeps working.
- [ ] **Step 2: Run `make api-test`.** Expect FAIL.
- [ ] **Step 3: Implement the changes.** The rate-limit key stays `${ip}:${normalized login}`.
- [ ] **Step 4: Run `make api-check`.** Expect PASS.
- [ ] **Step 5: Commit.** `feat(auth): log in with e-mail; expose account state`

### Task 4: Sign-up and e-mail confirmation

**Files:**

- Create: `apps/api/src/users/domain/auth-token.ts`, `users/domain/auth-token-repository.ts`, `users/adapters/postgres/auth-token-repository.ts` (+ contract + test)
- Create: `apps/api/src/users/app/sign-up.ts`, `users/app/confirm-email.ts`, `users/app/resend-confirmation.ts` (+ tests)
- Create: `apps/api/src/users/app/emails.ts` (+ test): PT-BR templates
- Modify: `platform/postgres/migrations.ts` (append `020_auth_tokens`), `users/adapters/http/auth-routes.ts`, `repositories.ts`, `compose.ts`, `compose.test.ts`

**Interfaces:**

- Produces table `auth_tokens(id TEXT PK, user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL CHECK (kind IN ('confirm_email','reset_password')), token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`.
- Produces `AuthTokenRepository`:
  - `issue({ userId, kind, tokenHash, expiresAt }): Promise<void>`;
  - `consume(tokenHash, kind, now: Date): Promise<{ userId: string } | null>`, which atomically sets `used_at` only when unused and unexpired;
  - `revokeAll(userId, kind, now): Promise<void>`.
- Produces templates `confirmEmailMessage(to, link)`, `signupAttemptMessage(to, resetLink)`, `resetPasswordMessage(to, link)` and `invitationMessage(to, condoName, link)`. Each returns an `EmailMessage` with the exact subjects from Global Constraints. Links:
  - confirm: `${appUrl}/#/confirmar-email/<token>`;
  - reset: `${appUrl}/#/redefinir-senha/<token>`;
  - invite: `${appUrl}/#/convite/<token>`.
- Produces routes:
  - `POST /auth/signup` `{ name, email, password }` → 202 `{}`.
  - `POST /auth/email/confirm` `{ token }` → 200 `sessionResponse` (it logs in), or 404 `"Link inválido ou expirado"`.
  - `POST /auth/email/resend` (session + CSRF) → 204. A no-op when already confirmed.
- Produces the `afterEmailConfirmed(userId)` hook: `confirmEmail` takes a callback, and Task 7 wires invitation activation into it.
- Sign-up and resend use their own limiter: `createRateLimiter({ maxAttempts: 10, windowMs: 3_600_000, lockoutMs: 3_600_000 })` keyed by IP. Every request calls `fail()`; over the limit → 429 `"Muitas tentativas, tente mais tarde"`.

- [ ] **Step 1: Write failing tests.**
  - The new e-mail case: sign-up creates an unconfirmed user, and the in-memory sender holds a `"Confirme seu e-mail no Morada"` to that address.
  - The taken e-mail case: still 202, no second user, the owner receives `signupAttemptMessage`.
  - Confirming sets `emailVerifiedAt`, logs in, and the same token a second time → 404.
  - An expired token (issued with `expiresAt` in the past) → 404.
  - Resend revokes the previous confirm tokens.
  - The 11th sign-up from one IP → 429.
- [ ] **Step 2: Run `make api-test`.** Expect FAIL.
- [ ] **Step 3: Implement.** Compose injects `EmailSender`: tests use `InMemoryEmailSender`, otherwise `config.email ? new CloudflareEmailSender(...) : config.isProduction ? new DisabledEmailSender() : new InMemoryEmailSender()`. `buildApp(repos, opts?: { email?: EmailSender; now?: () => Date })` gets this optional second argument.
- [ ] **Step 4: Run `make api-check`.** Expect PASS.
- [ ] **Step 5: Commit.** `feat(auth): open sign-up with e-mail confirmation`

### Task 5: Forgot and reset password

**Files:**

- Create: `apps/api/src/users/app/request-password-reset.ts`, `users/app/reset-password.ts` (+ tests)
- Modify: `users/adapters/http/auth-routes.ts`, `compose.test.ts`

**Interfaces:**

- Consumes: Task 4 `AuthTokenRepository`, templates, `sessionResponse`.
- Produces routes:
  - `POST /auth/password/forgot` `{ email }` → always 204. It sends `resetPasswordMessage` only when an e-mail account exists. Same IP limiter policy as sign-up.
  - `POST /auth/password/reset` `{ token, password }` → 200 `sessionResponse`. It sets the new hash, marks the e-mail verified when not yet, and revokes other reset tokens. Bad token → 404 `"Link inválido ou expirado"`.

- [ ] **Step 1: Write failing tests.**
  - An unknown e-mail → 204, nothing sent.
  - A known e-mail → 204, the message carries a link with a token.
  - Reset changes the password: the old one fails, the new one logs in. It marks the e-mail verified and runs the Task 4 `afterEmailConfirmed` hook.
  - Token reuse → 404. A token older than 1 h → 404.
- [ ] **Step 2: Run `make api-test`.** Expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `make api-check`.** Expect PASS.
- [ ] **Step 5: Commit.** `feat(auth): forgot and reset password by e-mail`

### Task 6: Invitations — model and admin actions

**Files:**

- Create feature `apps/api/src/invitations/` with `domain/{invitation.ts, invitation-repository.ts, errors.ts}`, `app/{create-invitation.ts, get-invitation-status.ts, revoke-invitation.ts}` (+ tests), `adapters/postgres/invitation-repository.ts`, `adapters/invitation-repository.contract.ts`, and `adapters/http/routes.ts`. Use `make new-feature app=api name=invitations spec=docs/superpowers/specs/2026-10-22-morada-saas-multi-condominio-design.md`.
- Modify: `platform/postgres/migrations.ts` (append `021_invitations`), `repositories.ts` (`forCondo(id).invitations` plus the unscoped `invitationTokens`), `compose.ts`, `compose.test.ts`

**Interfaces:**

- Produces the table:

  ```
  invitations(id TEXT PK,
              condominium_id TEXT NOT NULL REFERENCES condominiums(id),
              resident_id TEXT NOT NULL REFERENCES residents(id),
              role TEXT NOT NULL CHECK (role IN ('morador')),
              email TEXT,
              token_hash TEXT NOT NULL UNIQUE,
              status TEXT NOT NULL CHECK (status IN ('pendente','aceito','revogado')),
              expires_at TIMESTAMPTZ NOT NULL,
              created_by TEXT NOT NULL REFERENCES users(id),
              claimed_by TEXT REFERENCES users(id),
              accepted_at TIMESTAMPTZ,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now())
  ```

  plus an index on `(condominium_id, resident_id)`. `expirado` is derived on read: `status = 'pendente' AND expires_at <= now`.

- Produces `Invitation` and `InvitationStatus = 'pendente' | 'aceito' | 'expirado' | 'revogado'`.
- Produces `CondoInvitationRepository` (constructor-scoped to the condominium, like the other repos):
  - `latestForResident(residentId): Promise<Invitation | null>`;
  - `create(input): Promise<Invitation>`, which revokes any `pendente` row for the same resident in the same transaction;
  - `revoke(residentId): Promise<void>`.
- Produces `InvitationTokenRepository` (unscoped, token-hash lookups only):
  - `findByTokenHash(hash): Promise<Invitation | null>`;
  - `claim(id, userId): Promise<boolean>`, which sets `claimed_by` only when it is null and the row is `pendente`;
  - `accept(id, at): Promise<boolean>`, which moves `pendente` → `aceito` only once;
  - `claimedBy(userId): Promise<Invitation[]>`, which lists `pendente` rows claimed by that user.
- Produces admin routes (admin role, under `/api/condos/:condoId`):
  - `POST /residents/:id/invitation` `{ email?: string }` → 201 `{ status, email, expiresAt, link, whatsappUrl }`.
    - `email` defaults to the resident's stored e-mail when that is a valid address.
    - When an e-mail is present, `invitationMessage` is sent.
    - `whatsappUrl = https://wa.me/<digits of resident.phone>?text=<encodeURIComponent("Olá, <first name>! Seu acesso ao <condo name> no Morada: <link>")>`; it falls back to `https://wa.me/?text=…` when there is no phone.
  - `GET /residents/:id/invitation` → `{ status, email, expiresAt } | null` (never a link).
  - `POST /residents/:id/invitation/revoke` → 204.
  - Foreign or unknown resident → 404.

- [ ] **Step 1: Write failing tests.**
  - The contract runs `create` → `latestForResident` and the revoke-previous behaviour, and derives `expirado` from `expires_at`.
  - `foreign resident is 404` (condo B's admin on condo A's resident, for POST/GET/revoke). No row is written.
  - The e-mail is sent only when present.
  - `whatsappUrl` exactly matches for phone `"(11) 98888-7777"` → `https://wa.me/11988887777?text=…`. Add the `55` country code when the digits have 10–11 characters: `https://wa.me/5511988887777?text=…`.
  - The disabled sender makes POST 503 when an e-mail is given. With no e-mail it still succeeds.
- [ ] **Step 2: Run `make api-test`.** Expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `make api-check`.** Expect PASS.
- [ ] **Step 5: Commit.** `feat(invitations): resident invitations with WhatsApp, e-mail and link`

### Task 7: Accepting an invitation

**Files:**

- Create: `apps/api/src/invitations/app/{preview-invitation.ts, accept-invitation.ts, activate-claimed-invitations.ts}` (+ tests), `invitations/adapters/http/public-routes.ts`
- Modify: `condos/domain/condo-repository.ts` + Postgres adapter + contract (add `deactivateResidentGrants(condominiumId, residentId, exceptUserId): Promise<void>`), `compose.ts`, `compose.test.ts`

**Interfaces:**

- Consumes: Task 6 `InvitationTokenRepository`, Task 4 hook + `sessionResponse`, `CondoRepository.grant`.
- Produces `GET /auth/invitations/:token` → `{ condoName, residentName, apt, email: string | null, accountExists: boolean }`. `accountExists` is computed only when `email` is set; otherwise it is `false`. Invalid → 404 `"Convite inválido ou expirado"`.
- Produces `POST /auth/invitations/:token/accept` `{ email?, password, name? }` → 200 `sessionResponse`. The rules:
  1. The invite is invalid, expired, revoked, accepted, or claimed by someone else → 404.
  2. The e-mail used is `invite.email`, or, when that is null, the required body `email`.
  3. An account with that e-mail exists → the password must match (else 401 `"Usuário ou senha inválidos"`, invite untouched).
     - If the account is verified, or the invite had an e-mail: grant + accept now.
     - Otherwise: claim and send the confirmation.
  4. No account exists → create the user (`name` required, `role: 'resident'`, `residentId: null`).
     - With `invite.email` set: `emailVerifiedAt = now`, grant + accept now.
     - Without it: unverified, claim, send `confirmEmailMessage`.
  5. "Grant + accept" means: `condos.grant({ condominiumId, userId, role: 'morador', residentId })`, then `invitations.accept`, then `condos.deactivateResidentGrants(condominiumId, residentId, userId)` (which retires the legacy derived login).
- Produces `activateClaimedInvitations(userId)`, wired as Task 4's `afterEmailConfirmed`. It runs grant + accept for every `pendente` invitation the user claimed, regardless of `expires_at`.
- Accept uses the sign-up IP limiter policy.

- [ ] **Step 1: Write failing tests.**
  - `accept is single use`.
  - `existing account must authenticate`.
  - An e-mail invite with a new account logs in with the condo listed and `emailVerified: true`.
  - A WhatsApp invite with a new account gets `condos: []` and `emailVerified: false`; `claim activates on confirmation` then lists the condo after `/auth/email/confirm`.
  - `claimed invite cannot be claimed again` (a second account → 404).
  - The legacy derived login of that resident gets 401 after acceptance (zero condos, no e-mail).
  - The preview never leaks the token or the resident's phone.
- [ ] **Step 2: Run `make api-test`.** Expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `make api-check`.** Expect PASS.
- [ ] **Step 5: Commit.** `feat(invitations): accept invite and retire the legacy login`

### Task 8: Create the first condominium

**Files:**

- Create: `apps/api/src/condos/app/create-my-condominium.ts` (+ test)
- Modify: `condos/domain/condo-repository.ts` + Postgres adapter + contract (add `ownedOrganization(userId): Promise<{ id: string } | null>`), `condos/adapters/http/routes.ts` (`meRoutes`), `compose.test.ts`

**Interfaces:**

- Produces `POST /me/condos` (session + CSRF) `{ name: string (trim, 1..120) }` → 201 `CondoSummary` with `role: 'admin'`. The steps:
  - requires `emailVerifiedAt` (else 403 `"Confirme seu e-mail antes de criar um condomínio"`);
  - reuses `ownedOrganization(userId)`, or creates an organization named after the condominium;
  - `create({ organizationId, name, monthlyFeeCents: 0, dueDay: 10 })`;
  - grants `administrador`.

- [ ] **Step 1: Write failing tests.**
  - An unverified user → 403.
  - A verified user → 201; `/me` then lists it as admin.
  - A second condo reuses the same organization.
  - A blank name → 400.
  - A user who is only a `morador` elsewhere creates their own organization.
- [ ] **Step 2: Run `make api-test`.** Expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `make api-check`.** Expect PASS.
- [ ] **Step 5: Commit.** `feat(condos): a confirmed user creates their first condominium`

### Task 9: Web — entry flows (login, sign-up, confirmation, reset, first condo)

**Files:**

- Create: `apps/web/src/shared/lib/public-route.ts` (+ test)
- Create web feature `apps/web/src/features/account/` (follow `residents` layering):
  - `domain/{account-schemas.ts, account-repository.ts}`
  - `data/http-account-repository.ts` (+ test)
  - `ui/{signup-screen.tsx, confirm-email-screen.tsx, pending-confirmation-screen.tsx, forgot-password-screen.tsx, reset-password-screen.tsx, create-condo-screen.tsx}` (+ tests)
- Modify: `features/session/domain/login-response.ts` (+ test), `features/session/ui/{session-store.ts, login-screen.tsx}` (+ tests), `app/{app.tsx, container.ts}` (+ tests)

**Interfaces:**

- Produces `parsePublicRoute(hash: string): { kind: 'convite' | 'confirmar-email' | 'redefinir-senha'; token: string } | null` for `#/convite/<t>`, `#/confirmar-email/<t>`, `#/redefinir-senha/<t>`. The token must match `/^[A-Za-z0-9_-]{20,128}$/`. Also `clearPublicRoute()`, which uses `history.replaceState` to drop the hash.
- Produces `parseLoginResponse(data): { condos: LoginCondo[]; emailVerified: boolean }`. An empty `condos` is now allowed.
- Produces session store state:
  - `account: { emailVerified: boolean } | null`;
  - `applyLogin({ condos, emailVerified })`: with ≥ 1 condo it behaves as today; with zero it sets `account` and `role: null`.
  - The app renders:
    - `account && !emailVerified` → `PendingConfirmationScreen` (resend + sign out);
    - `account && emailVerified` → `CreateCondoScreen` (title `"Que condomínio vamos gerenciar hoje?"`, one field `"Nome do condomínio"`; on success `applyLogin` with the new condo).
- Produces login screen changes:
  - field label `"E-mail ou usuário"`, sends `{ login, password }`;
  - links `"Criar conta"` and `"Esqueci a senha"`, which switch a local `entry` state.
- Produces the sign-up success state: copy `"Enviamos um link para <email>. Abra no celular para confirmar."`
- Produces the hash-route precedence: a public route renders its screen before any session view. Each one finishes with `clearPublicRoute()`, then `applyLogin(response)`.

- [ ] **Step 1: Write failing tests.**
  - `parsePublicRoute` accepts the three forms and rejects a short or garbage token.
  - The login screen sends `login`.
  - `applyLogin` with zero condos shows the pending or create screen.
  - The confirm screen posts the token and lands in the app.
  - The reset screen validates `min 8` and matching confirmation.
  - The create-condo screen rejects a blank name and lands as admin.
  - Errors render explicitly (404 → `"Link inválido ou expirado"`).
- [ ] **Step 2: Run `make test`.** Expect FAIL.
- [ ] **Step 3: Implement** with existing primitives (`Screen`, `ScreenBody`, `primitives.tsx`), mobile-first.
- [ ] **Step 4: Run `make check`.** Expect PASS.
- [ ] **Step 5: Commit.** `feat(web): e-mail login, sign-up, confirmation, reset and first condominium`

### Task 10: Web — invite residents and accept invitations; e2e

**Files:**

- Create in web `features/invitations/`: `domain/invitation.ts`, `data/http-invitation-repository.ts` (+ test), `ui/{resident-access-screen.tsx, accept-invite-screen.tsx}` (+ tests)
- Modify: `app/app.tsx`, `app/container.ts`, `app/app.test.tsx`
- Delete: `features/residents/ui/create-login-screen.tsx` and its tests (replaced). Remove `provisionResidentLogin` from the container.
- Modify API: remove `POST /users` from `compose.ts`, then delete `users/adapters/http/routes.ts`, `users/app/create-resident-login.ts` (+ tests) and their `compose.test.ts` cases.
- Modify: `apps/web/e2e/journey.spec.ts`, `apps/web/e2e/smoke.spec.ts` (label `"E-mail ou usuário"`)

**Interfaces:**

- Consumes: Task 6 admin routes, Task 7 public routes, Task 9 `parsePublicRoute` / `applyLogin`.
- Produces `ResidentAccessScreen` (the view `a-resident-login` keeps its id; the entry button on the apartment screen reads `"Acesso do morador"`):
  - No invite yet: an e-mail field (prefilled from the resident) and `"Gerar convite"`.
  - After creation: three actions, `"Enviar pelo WhatsApp"` (opens `whatsappUrl` via `window.open(url, '_blank', 'noopener')`), `"Enviar por e-mail"` (shown only when an e-mail exists; the API already sent it, so this shows `"E-mail enviado para <email>"`), and `"Copiar link"` (clipboard helper).
  - Pending later: `"Convite pendente · vence em <dd/mm>"` with `"Reenviar"` (new link) and `"Revogar"` (confirm dialog).
  - Accepted: `"Acesso ativo por e-mail"`.
  - Expired / revoked: shown as such, with `"Gerar novo convite"`.
  - A legacy login, when one exists, is shown below with the existing `"Redefinir senha"`.
- Produces `AcceptInviteScreen`:
  - shows `"Você foi convidado para o <condoName>"` and `"<residentName> · <apt>"`;
  - asks for the e-mail (locked when the invite has one), the password, and the name (only when there is no account);
  - ends with `applyLogin`, or the pending-confirmation screen.

- [ ] **Step 1: Write failing tests.**
  - The access screen covers every state, the WhatsApp URL passthrough, copy and revoke confirmation.
  - The accept screen covers both modes (existing account vs new) and the 404 copy.
  - e2e journey:
    - the admin creates a resident with e-mail `e2e-<timestamp>@morada.test` and generates an invite;
    - the test reads the link from the `"Copiar link"` value (`data-testid="invite-link"`);
    - it opens the link in a fresh context, creates the password and lands on `"Olá, <first name>"`;
    - the remaining receipt/pay steps stay as today.
- [ ] **Step 2: Run `make test`.** Expect FAIL.
- [ ] **Step 3: Implement and remove the derived-login provisioning (API + web).**
- [ ] **Step 4: Run `make check`, `make api-check`, then `make e2e`.** Expect all PASS.
- [ ] **Step 5: Commit.** `feat(invitations): invite residents from the apartment and accept by link`

### Task 11: Provisioning, docs and vocabulary

**Files:**

- Create: `apps/api/src/set-user-email.ts` (+ test of its pure core `setUserEmail(users, username, email)`), run through a `package.json` script `set-user-email`
- Modify: `Makefile` (`set-user-email username=… email=…` target), `docs/DEPLOY.md`, `docs/DATA-MODEL.md`, `CLAUDE.md`

**Interfaces:**

- Produces `setUserEmail(users: UserRepository, username: string, email: string): Promise<void>`. It sets the normalized e-mail and `emailVerifiedAt = now` on the legacy user. An unknown username → `UnknownUserError`; a taken e-mail → `EmailTakenError`.

- [ ] **Step 1: Write failing tests** for `setUserEmail` (normalizes, verifies, both error paths).
- [ ] **Step 2: Run `make api-test`.** Expect FAIL.
- [ ] **Step 3: Implement the script.** Update the docs:
  - DEPLOY.md: the secrets `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_EMAIL_API_TOKEN`, `EMAIL_FROM` and `APP_URL` (`fly secrets set …`); the Email Sending domain onboarding; the owner-email step `fly ssh console -C "node dist/set-user-email.js admin <email>"`; the stale `CLOUDFLARE_API_TOKEN` rotation note.
  - DATA-MODEL.md: `users` columns, `auth_tokens`, `invitations`.
  - CLAUDE.md vocabulary: `User` (login by e-mail; legacy username), `Invitation`, `AuthToken`.
- [ ] **Step 4: Run `make api-check && make check`.** Expect PASS.
- [ ] **Step 5: Commit.** `docs: accounts and invitations deploy, data model and vocabulary`
