# Morada API

Hono + Postgres (pg), hexagonal architecture (domain / app / adapters /
platform), Zod at every boundary, JWT auth. Boundaries are lint-enforced.

## Run

```bash
make api-dev        # or: pnpm --filter @morada/api dev  (serves on :8787)
make api-test       # pnpm --filter @morada/api test:coverage  (gate = 80%)
```

Env: `PORT`, `JWT_SECRET` (required in production — startup fails without it),
`DATABASE_URL` (Postgres; defaults to the local docker DB), `WEB_ORIGIN` (CORS,
default Vite dev origin), `APP_URL` (base of e-mailed links, default the first
`WEB_ORIGIN`), `BCRYPT_COST` (default 12), `PROXY_SECRET` (optional; when set, the
client IP forwarded by the Pages worker in `X-Morada-Client-IP` is trusted only with
a matching `X-Morada-Proxy-Secret`).

## Auth model

- `POST /auth/login { login, password }` accepts an e-mail or a legacy username,
  verifies the bcrypt-hashed password and sets the httpOnly `session` cookie (an
  HS256 JWT, 8h) plus the readable `csrf` cookie. It answers
  `{ condos, emailVerified }`; bad credentials return 401.
- Residents join by invitation. An admin creates one via
  `POST /api/condos/:id/residents/:rid/invitation { email? }` (admin-only), which
  returns the link and a WhatsApp URL once and e-mails it when an address is
  given. `emailSent` says whether that e-mail went out; an unavailable or failed
  send never fails the invite. The resident accepts it at `POST /auth/invitations/:token/accept`.
  Derived username logins can no longer be provisioned; existing ones keep the
  admin reset (`POST /api/residents/:id/login/reset`).
- `authMiddleware(resolveSessionVersion)` is a factory: it verifies the session JWT
  and rejects it (401) unless its `sv` claim matches the user's stored
  `session_version` (bumped on password reset, e-mail confirmation, admin
  password reset and logout). `compose.ts` wires it once with the user lookup; `requireRole`
  guards admin routes.
- Authorization: residents/accounts/invitations are **admin-only**;
  receipts/dashboard are any authenticated user; notices are read-any /
  **write-admin**; thread listing is **admin-only** and per-thread access is
  scoped to the caller's `sub` (a resident can only read/write their own thread).
- SQL is fully parameterized; passwords are hashed with bcrypt (never stored or
  logged in plaintext); message `author` is derived from the verified role
  (never trusted from the body); `POST` never accepts a client id.

## Roles, team, activity and Pix routes

Permissions come from `condos/domain/permissions.ts`: `administrador` has all seven,
`sindico` has `view_building`, `publish_notices`, `manage_residents` and
`manage_money`, `morador` has none. A missing permission in a reachable condo answers
403 `"Acesso negado"`.

| Route                                              | Guard           | Purpose                                                         |
| -------------------------------------------------- | --------------- | --------------------------------------------------------------- |
| `PUT /api/condos/:id/settings`                     | `manage_fees`   | Fee, due day and Pix key                                        |
| `PUT /api/condos/:id/info`                         | `manage_condo`  | Rename the condominium                                          |
| `GET /api/condos/:id/pix`                          | any member      | Pix key, receiver and city (or `configured: false`)             |
| `GET /api/condos/:id/activity`                     | `view_activity` | Activity log, newest first                                      |
| `GET /api/condos/:id/sindico`                      | `manage_condo`  | Current síndico and latest invitation                           |
| `POST /api/condos/:id/sindico/invitation`          | `manage_condo`  | Invite a síndico (e-mail required)                              |
| `POST /api/condos/:id/sindico/invitation/revoke`   | `manage_condo`  | Revoke the pending invitation                                   |
| `POST /api/condos/:id/sindico/remove`              | `manage_condo`  | Deactivate the current síndico                                  |
| `GET /api/orgs/:orgId`                             | org owner       | Organization, members and pending invitations                   |
| `PUT /api/orgs/:orgId`                             | org owner       | Rename the organization                                         |
| `POST /api/orgs/:orgId/invitations`                | org owner       | Invite a member or owner                                        |
| `POST /api/orgs/:orgId/invitations/:id/revoke`     | org owner       | Revoke a member invitation                                      |
| `PUT /api/orgs/:orgId/members/:userId/condos`      | org owner       | Assign the member's condominiums                                |
| `POST /api/orgs/:orgId/members/:userId/deactivate` | org owner       | Deactivate a member and their `administrador` grants in the org |

Org routes answer 404 `"Organização não encontrada"` to anyone who is not an owner.
Only one síndico is active per condominium; accepting a new invitation replaces the
previous one atomically. The web sends `X-Morada-View: admin | resident` so a staff
user with a resident grant can switch between "O prédio" and "Minha casa".

## Seeded login

The database seeds **only the admin login** — **change it before any real
deployment** (it is intentionally weak). Every resident, their login, and all
accounts/receipts/notices are created through the app.

| Role  | Username | Password       |
| ----- | -------- | -------------- |
| Admin | `admin`  | `morada-admin` |

To onboard a resident: the admin creates the resident and generates an invitation
from "Acesso do morador". The resident opens the link, sets a password and lands in
the app; later logins use the e-mail and that password.

## Still deferred (post-auth hardening)

1. **Per-resident receipt scoping.** Receipts are not yet linked to a resident
   (no owner column), so `/api/receipts` is open to any authenticated user. Once
   receipts carry a `resident_id`, scope reads/pay by the caller's `sub` — the
   same pattern threads already use — before real multi-resident use.
2. **Gate demo seeding for production.** `seedDatabase` runs on every boot and
   inserts the documented demo logins. Put it behind `!isProduction` / an
   explicit `SEED_DEMO_DATA` flag before deploying against a real database.
3. Refresh/revocation (logout) — tokens are valid for their full 8h.
4. A validated `WEB_ORIGIN` allowlist and CI action version bumps.
