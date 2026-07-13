# Data model — apartments, residents, occupancy

> The **apartment** is the stable anchor of the ledger. Residents come and go; the
> apartment (and its history) persists. This is the source-of-truth spec for the
> apartment/resident relationship. Introduced 2026-07-13.

## Entities

### Apartment (`apartments`)

The stable unit and ledger anchor. Created on demand (find-or-create by label)
the first time a resident is registered for it; never deleted; survives resident
turnover.

| Column  | Notes                   |
| ------- | ----------------------- |
| `id`    | stable id (UUID)        |
| `label` | unique, e.g. `Apto 302` |

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
2. Provision the login (`POST /api/users`): issues a temp password; `sub` = the
   resident's id.

### Turnover (resident leaves, another moves in)

1. Mark the current resident as moved out (occupancy `active = 0`). Their
   receipts and history stay attached to them and to the apartment.
2. Register the next resident for the same apartment (new resident + active
   occupancy). Same `apartment_id` → the apartment's history is continuous.

## Auth / scoping

JWT `sub = resident_id`. A resident only ever reads their own record (`/me`) and
their own receipts. The apartment id is resolved from the resident's occupancy
when issuing a charge and for apartment-level queries.
