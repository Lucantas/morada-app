# Data model — condominiums, apartments, residents, occupancy

> The **apartment** is the stable anchor of the ledger. Residents come and go; the
> apartment (and its history) persists. This is the source-of-truth spec for the
> apartment/resident relationship. Introduced 2026-07-13.

## Entities

### Apartment (`apartments`)

The stable unit and ledger anchor. Created on demand (find-or-create by label)
the first time a resident is registered for it; never deleted; survives resident
turnover.

| Column  | Notes                                   |
| ------- | --------------------------------------- |
| `id`    | stable id (UUID)                        |
| `label` | unique per condominium, e.g. `Apto 302` |

### Resident (`residents`)

A person. Belongs to an apartment through an **occupancy** (below).

| Column   | Notes                                                |
| -------- | ---------------------------------------------------- |
| `id`     | UUID; the JWT `sub` for their login                  |
| `name`   |                                                      |
| `phone`  |                                                      |
| `email`  |                                                      |
| `status` | payment status: `em_dia` \| `pendente` \| `atrasado` |

### Occupancy (`apartment_residents`)

The relational link apartment ↔ resident, with an active flag.

| Column         | Notes                                   |
| -------------- | --------------------------------------- |
| `id`           | UUID                                    |
| `apartment_id` | → `apartments.id`                       |
| `resident_id`  | → `residents.id`                        |
| `active`       | `1` = current occupant, `0` = moved out |

**Invariant (DB-enforced): at most one _active_ occupancy per apartment.**
A partial unique index `idx_one_active_resident_per_apartment ON
apartment_residents(apartment_id) WHERE active = 1` guarantees it — trying to
activate a second resident in an occupied apartment fails and surfaces as
`ApartmentOccupiedError` (409).

### Receipt (`receipts`)

A charge, tied to **both** the apartment (stable) and the resident who was
charged (so "Fulana"'s receipts never appear under "Siclana").

| Column                                                               | Notes                               |
| -------------------------------------------------------------------- | ----------------------------------- |
| `id`, `ref`, `title`, `due_label`, `value_cents`, `status`, `method` | as before                           |
| `resident_id`                                                        | who was charged                     |
| `apartment_id`                                                       | the apartment the charge belongs to |

## Query modes

- **Resident's own receipts** — `WHERE resident_id = :sub`. This is what a
  logged-in resident sees; it never includes a previous occupant's receipts.
- **Apartment's full ledger** — `WHERE apartment_id = :apartmentId`. Every
  receipt of every resident who has occupied the apartment (admin / apartment
  view). The general view UI is deferred; the query is available.

## Flows

### Onboarding (admin)

1. Register a resident: name + apartment label + contact. → find-or-create the
   apartment by label; create the resident; create an **active** occupancy.
   If the apartment already has an active occupant → `ApartmentOccupiedError`.
2. Invite the resident (`POST /api/condos/:id/residents/:rid/invitation`): the
   resident opens the link, creates (or reuses) an e-mail account and receives the
   `morador` grant tied to that resident. Derived logins are no longer provisioned;
   existing legacy logins keep working (and keep the admin password reset) until
   the invitation is accepted.

### Turnover (resident leaves, another moves in)

1. Mark the current resident as moved out (occupancy `active = 0`). Their
   receipts and history stay attached to them and to the apartment.
2. Register the next resident for the same apartment (new resident + active
   occupancy). Same `apartment_id` → the apartment's history is continuous.

## Auth / scoping

JWT `sub = resident_id`. A resident only ever reads their own record (`/me`) and
their own receipts. The apartment id is resolved from the resident's occupancy
when issuing a charge and for apartment-level queries.

## Multi-condominium (migrations 015–018)

### Tenancy tables

| Table                  | Notes                                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `organizations`        | `id`, `name`, `active`. Owns condominiums                                                                                                                  |
| `condominiums`         | `id`, `organization_id` → `organizations`, `name`, `active`                                                                                                |
| `organization_members` | `organization_id`, `user_id`, `role` `owner` \| `member`, `active`; unique per org + user                                                                  |
| `condo_roles`          | `condominium_id`, `user_id`, `role` `administrador` \| `sindico` \| `morador`, `resident_id` (set for `morador`), `active`; unique per condo + user + role |

### condominium_id everywhere

`condominium_id TEXT NOT NULL` (FK → `condominiums`, indexed) on `apartments`,
`residents`, `accounts`, `receipts`, `notices`, `threads`, `categories`,
`incomes` and `condo_settings`. Repositories never query without it, and a
resource of another condominium answers 404. `threads` also carry `resident_id`
and `apartment_id`; `accounts` carry an optional `due_date`.

### Per-condominium uniqueness

- `apartments`: `UNIQUE (condominium_id, label)` (was global on `label`).
- `condo_settings`: primary key is `condominium_id` (the singleton `id` column is gone).
- Categories have no unique constraint; they are scoped only by `condominium_id`.
- `idx_receipts_condo_fee_month` is `(resident_id, ref)`; it is per-condominium only implicitly, because a resident belongs to exactly one condominium.
- The one-active-occupant-per-apartment invariant is unchanged.

### Access rule (`CondoRepository.accessFor(userId, condominiumId)`)

Returns the user's access to one condominium, or `null` (the API answers 404).
Nothing is granted when the condominium or its organization is inactive.

- **Owner branch:** an active `owner` `organization_members` row of the owning
  organization grants `administrador` on every active condominium of it.
- **`administrador`:** needs an active `condo_roles` row **and** an active
  `organization_members` row (any role) in the owning organization.
- **`sindico`:** the grant exists but resolves to no access in SP1.
- **`morador`:** needs an active `condo_roles` row **and** an active occupancy
  whose apartment and resident both belong to that same condominium.

The session JWT identifies the user; the current condominium comes from the
route (`/api/condos/:condoId/...`), and login returns `{ condos }` (the
condominiums the user can enter, with the resolved role).

## Accounts and invitations (migrations 019–023)

### Users (`users`)

Login identity. New accounts sign in by e-mail; legacy derived logins keep their
`username` until the resident accepts an invitation.

| Column              | Notes                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `username`          | nullable (019); legacy derived login, e.g. `lucia303`                                                                     |
| `email`             | nullable, normalized (`trim().toLowerCase()`); partial unique index `idx_users_email`                                     |
| `name`              | nullable display name                                                                                                     |
| `email_verified_at` | set by e-mail confirmation (needs the account password) or by `set-user-email`                                            |
| `session_version`   | (021) the JWT carries it as `sv`; a mismatch is a 401. Bumped by password reset, e-mail confirmation and sign-up takeover |

Sign-up over an **unverified** e-mail replaces its credentials (takeover) and
releases its invite claims; over a **verified** one the owner is told someone
tried, with a reset link.

### AuthToken (`auth_tokens`, 020)

Single-use e-mail links. Only the SHA-256 hex of the token is stored.

| Column                  | Notes                                            |
| ----------------------- | ------------------------------------------------ |
| `user_id`               | → `users.id`                                     |
| `kind`                  | `confirm_email` (24 h) \| `reset_password` (1 h) |
| `token_hash`            | unique                                           |
| `expires_at`, `used_at` | `used_at` set on consumption                     |

### Invitation (`invitations`, 022–023)

An admin's invite for a resident to take over a `morador` grant in one condominium.

| Column                     | Notes                                                                             |
| -------------------------- | --------------------------------------------------------------------------------- |
| `condominium_id`           | → `condominiums.id`; cross-condo access answers 404                               |
| `resident_id`              | → `residents.id`                                                                  |
| `role`                     | `morador` only in SP2                                                             |
| `email`                    | optional target address                                                           |
| `token_hash`               | unique SHA-256 hex; the raw token is shown once at creation (7 days)              |
| `status`                   | `pendente` \| `aceito` \| `revogado`; `expirado` is derived from `expires_at`     |
| `created_by`, `claimed_by` | → `users.id`; `claimed_by` is a WhatsApp invite claimed by an unconfirmed account |
| `accepted_at`              |                                                                                   |

`idx_invitations_one_pending` (023) allows **one `pendente` invitation per
resident**; resending revokes the previous one. Nothing is deleted: invitations
change `status`.

Accepting retires the resident's legacy derived-login grant (`condo_roles.active`
flips to 0). A claimed WhatsApp invite activates on e-mail confirmation and is
retried at login.
