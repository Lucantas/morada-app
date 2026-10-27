# Deploying Morada

Three services, mirroring the `longa-app` (pace) pattern:

| Layer    | Service                                                   | URL                          |
| -------- | --------------------------------------------------------- | ---------------------------- |
| Database | **Neon** serverless Postgres (region `aws-sa-east-1`)     | —                            |
| API      | **Fly.io** app `morada-api` (region `gru`), scale-to-zero | https://morada-api.fly.dev   |
| Web      | **Cloudflare Pages** project `morada`                     | https://morada-a6g.pages.dev |

## Cost posture

The API runs one `shared-cpu-1x` / 256 MB machine with `auto_stop_machines = "stop"`
and `min_machines_running = 0`: it scales to zero when idle and cold-starts (~1-2 s)
on the next request. Neon's free serverless Postgres also scales to zero.
Steady-state cost is effectively **$0/mo**.

## Architecture notes

- The API is a single esbuild bundle (`apps/api/build.mjs` → `dist/main.js` +
  `dist/migrate-main.js` + `dist/set-user-email.js`). No native dependencies, so the runtime image is a plain
  `node:22-slim` with no `node_modules`.
- **Migrations run on release**, not at boot: `fly.toml`'s
  `release_command = "node dist/migrate-main.js"` applies pending migrations against
  `DATABASE_URL` before the new machine rolls in. The runner (`platform/postgres/migrate.ts`)
  is idempotent and tracks applied ids in `_migrations`.
- `DATABASE_URL` uses Neon's **direct** (non-pooled) endpoint — a single small
  `pg.Pool` keeps the connection count low, and the direct endpoint avoids PgBouncer
  DDL edge cases when the release command migrates.
- CORS is scoped to `WEB_ORIGIN` (the Pages URL). Changing the Pages URL means
  updating that secret.
- `fly.toml` lives at the repo root so the Docker build context is the whole
  monorepo (the Dockerfile installs the workspace with pnpm). Deploy from the root.

## One-time setup

### 1. Neon (database)

Create a free project at https://neon.com in an `aws-sa-east-1` (São Paulo) region.
Copy the **direct** connection string (drop the `-pooler` from the host; it already
carries `?sslmode=require`). This is `DATABASE_URL`.

### 2. Fly (API)

```bash
fly apps create morada-api --org personal

fly secrets set --app morada-api --stage \
  DATABASE_URL="<neon direct connection string, ?sslmode=require>" \
  JWT_SECRET="$(openssl rand -base64 48)" \
  WEB_ORIGIN="https://morada-a6g.pages.dev"

# Deploy from the repo root (root fly.toml, monorepo build context).
fly deploy --remote-only
```

`NODE_ENV=production` and `PORT=8080` are baked into the Docker image; `BCRYPT_COST`
defaults to 12. The demo admin seed stays off in production (it is gated behind
`SEED_DEMO_DATA=1`) — production admin/data come from the restored database.

#### Payment-proof storage (Cloudflare R2)

Payment proofs are stored in the R2 bucket `morada-proofs` (S3-compatible API). Set the
four secrets on Fly (create the token in the Cloudflare dashboard → R2 → **Manage API
Tokens** → Object Read & Write, scoped to the bucket):

```bash
fly secrets set --app morada-api --stage \
  R2_ENDPOINT="https://<account_id>.r2.cloudflarestorage.com" \
  R2_ACCESS_KEY_ID="<r2 access key id>" \
  R2_SECRET_ACCESS_KEY="<r2 secret access key>" \
  R2_BUCKET="morada-proofs"
```

When all four are set, new proofs are written to R2 and served via
`GET /api/receipts/:id/proof` / `GET /api/incomes/:id/proof`. When any is missing, the API
falls back to storing the proof base64 in Postgres (dev/test default). Legacy base64 rows
keep being served by the same endpoints — no backfill needed.

> **Do not unset these once any row has a `proof_key`.** A proof written to R2 lives only in
> R2 (its DB `proof_data_url` is NULL); if the secrets are removed or you roll back to
> pre-R2 code, those proofs become unreadable (the receipt still reports `hasProof: true`
> but "Ver comprovante" 404s) until R2 is restored. They are not lost, just unreachable.

#### E-mail (Cloudflare Email Sending)

Sign-up, confirmation, password reset and invitations send e-mail through Cloudflare
Email Sending. Onboard the sending domain in the Cloudflare dashboard first (Email
Sending → add the domain, publish the SPF/DKIM DNS records it shows, wait until it
verifies). Then create an API token that can send e-mail and set:

```bash
fly secrets set --app morada-api --stage \
  CLOUDFLARE_ACCOUNT_ID="<account id>" \
  CLOUDFLARE_EMAIL_API_TOKEN="<email sending token>" \
  EMAIL_FROM="Morada <no-reply@<verified domain>>" \
  APP_URL="https://morada-a6g.pages.dev"
```

`APP_URL` is the base of every e-mailed link and defaults to the first `WEB_ORIGIN`.
Without the three e-mail secrets the API still starts: sign-up and "esqueci a senha"
answer 503 `"Envio de e-mail indisponível"`. Invitations are still created
(`emailSent: false`) and can be shared by WhatsApp or copied link, but only an
invitation **with** an e-mail can be accepted that way (the invite proves the
address). A link-only invitation (no e-mail) needs a confirmation e-mail, so with
e-mail sending off its acceptance answers 503 and creates no account; an already
confirmed account can still accept it.

Delivery failures (an upstream HTTP status, a network error or the 10 s timeout) are
logged server-side as `E-mail delivery failed:` with the upstream status, never the
token or the message body. Check `fly logs --app morada-api` when an admin reports
`emailSent: false`.

#### Client IP behind the Pages proxy (`PROXY_SECRET`)

Production traffic reaches Fly through the Pages worker (`apps/web/public/_worker.js`),
so `Fly-Client-IP` is the worker's egress IP. The worker forwards the real client IP
(`CF-Connecting-IP`) as `X-Morada-Client-IP` plus a shared secret in
`X-Morada-Proxy-Secret`, and strips both headers from the incoming request. The API
trusts `X-Morada-Client-IP` only when that secret matches `PROXY_SECRET`; otherwise
it falls back to `Fly-Client-IP`, then `X-Forwarded-For`. Without it every IP-keyed
rate limit (login, sign-up, forgot, invitations) collapses into one shared key.

Before (or at) the merge, generate one random value and set it in both places:

```bash
PROXY_SECRET="$(openssl rand -base64 48)"
fly secrets set --app morada-api --stage PROXY_SECRET="$PROXY_SECRET"
printf '%s' "$PROXY_SECRET" | pnpm dlx wrangler@4 pages secret put PROXY_SECRET \
  --project-name=morada
```

The Pages variable must be set for the **production** environment (the
`wrangler pages secret put` default; in the dashboard: Settings → Variables and
Secrets → Production) and takes effect on the next Pages deploy.

#### Owner e-mail (legacy admin)

The legacy `admin` login has no e-mail. After deploying, give it one (this also marks
it verified) so the owner can sign in by e-mail:

```bash
fly ssh console --app morada-api -C "node dist/set-user-email.js admin <email>"
```

Locally: `make set-user-email username=admin email=<email>` (or
`pnpm --filter @morada/api set-user-email admin <email>`). An unknown username or an
e-mail already in use exits with an error and changes nothing.

### 3. Cloudflare Pages (web)

```bash
pnpm dlx wrangler@4 pages project create morada --production-branch main

VITE_API_URL="https://morada-api.fly.dev" pnpm --filter @morada/web build
pnpm dlx wrangler@4 pages deploy apps/web/dist --project-name=morada \
  --branch=main --commit-dirty=true
```

The production alias is `https://morada-<suffix>.pages.dev` (Cloudflare appends a
suffix when `morada.pages.dev` is taken — ours is `morada-a6g`). Whatever it is, it
must match the API's `WEB_ORIGIN`.

## Database backup & restore

The live app data is authored locally in the `morada` Postgres (docker
`morada-postgres`, port 5433). **Always back up before any destructive DB op** —
dumps go to `backups/` (gitignored).

```bash
# Backup (plain SQL, schema + data)
docker exec -e PGPASSWORD=morada morada-postgres \
  pg_dump -U morada -d morada --no-owner --no-privileges > backups/morada-full-$(date +%Y%m%d-%H%M%S).sql

# Restore a dump into Neon (via the container's psql, direct endpoint)
cat backups/<dump>.sql | docker exec -e PGURL="<neon direct url>" -i morada-postgres \
  sh -c 'psql "$PGURL" -v ON_ERROR_STOP=1 -q'
```

The full dump includes the `_migrations` bookkeeping rows, so after a restore the
API's `release_command` migration is a no-op — schema and data land exactly as they
were.

## Migrating to multi-condomínio

Migrations `015`–`018` restructure the schema around condominiums. They run on
release (`release_command`), so back up first.

**Merging this branch to `main` IS the production deploy.** A green CI run on `main`
triggers `.github/workflows/deploy.yml`, whose Fly `release_command` runs migrations
`015`–`018` against Neon, and `.github/workflows/deploy-web.yml` deploys the web to
Cloudflare Pages in parallel. Therefore take the Neon `pg_dump` and the pre-deploy row
counts (step 1) BEFORE merging, not after.

Mixed-version window: until Fly swaps the old API machines for the new release, the old
API runs against the already-migrated schema, and the new web and the new API are not
deployed atomically (new web against old API, or the reverse, depending on which
pipeline finishes first). Expect brief login errors and 404s during this window; since
every session is invalidated anyway (step 4), everyone logs in again afterwards. To
narrow the window, deploy the API first and let it finish, then run `deploy-web.yml`
manually (`workflow_dispatch`) instead of relying on the parallel run.

1. **Take a `pg_dump` BEFORE deploying** (see Database backup & restore above):

   ```bash
   docker exec -e PGPASSWORD=morada morada-postgres \
     pg_dump -U morada -d morada --no-owner --no-privileges > backups/morada-pre-multicondo-$(date +%Y%m%d-%H%M%S).sql
   ```

   For Neon, dump with the direct URL the same way and keep the file. Also record the
   per-table row counts to compare against after the deploy:

   ```sql
   SELECT 'apartments' t, count(*) FROM apartments
   UNION ALL SELECT 'residents', count(*) FROM residents
   UNION ALL SELECT 'accounts', count(*) FROM accounts
   UNION ALL SELECT 'receipts', count(*) FROM receipts
   UNION ALL SELECT 'notices', count(*) FROM notices
   UNION ALL SELECT 'threads', count(*) FROM threads
   UNION ALL SELECT 'categories', count(*) FROM categories
   UNION ALL SELECT 'incomes', count(*) FROM incomes
   UNION ALL SELECT 'condo_settings', count(*) FROM condo_settings
   ORDER BY 1;
   ```

2. **What the migrations do**
   - `015_tenancy`: creates `organizations`, `condominiums`, `organization_members`,
     `condo_roles`; seeds `org-legacy` and `condo-legacy` ("Condomínio Morada · Bloco 2");
     adds `condominium_id` (backfilled to `condo-legacy`, then `NOT NULL`, indexed) to
     `apartments`, `residents`, `accounts`, `receipts`, `notices`, `threads`, `categories`,
     `incomes`, `condo_settings`; makes `apartments.label` unique per condominium; drops
     `condo_settings.id` (primary key becomes `condominium_id`); makes each existing admin
     user `owner` of `org-legacy` and `administrador` of `condo-legacy`, and each resident
     user `morador` there.
   - `016_thread_links`: adds `threads.resident_id` / `threads.apartment_id` and backfills them.
   - `017_account_due_date`: adds nullable `accounts.due_date`.
   - `018_drop_legacy_defaults`: drops the temporary `'condo-legacy'` column defaults.

3. **Rollback = restore the `pg_dump`.** Reverting the app image alone is NOT safe:
   `015` drops `condo_settings.id`, so the old code cannot run against the new schema.
   The dump is plain SQL without `DROP` statements, so restoring onto the
   already-migrated database would collide. First reset the target (drop and recreate
   the `public` schema, or drop and recreate the database), then load the dump, then
   redeploy the previous image:

   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f backups/<pre-multicondo dump>.sql
   ```

   The dump includes `_migrations`, so the restored database is back at schema `014`.

4. **Sessions:** the JWT shape changed, so login sessions issued before the deploy are
   invalidated and everyone has to log in again.

5. **Post-deploy verification** (run with `psql` against the target database):

   Per-table counts by condominium (must equal the pre-deploy totals from step 1, all under `condo-legacy`):

   ```sql
   SELECT 'apartments' t, condominium_id, count(*) FROM apartments GROUP BY 2
   UNION ALL SELECT 'residents', condominium_id, count(*) FROM residents GROUP BY 2
   UNION ALL SELECT 'accounts', condominium_id, count(*) FROM accounts GROUP BY 2
   UNION ALL SELECT 'receipts', condominium_id, count(*) FROM receipts GROUP BY 2
   UNION ALL SELECT 'notices', condominium_id, count(*) FROM notices GROUP BY 2
   UNION ALL SELECT 'threads', condominium_id, count(*) FROM threads GROUP BY 2
   UNION ALL SELECT 'categories', condominium_id, count(*) FROM categories GROUP BY 2
   UNION ALL SELECT 'incomes', condominium_id, count(*) FROM incomes GROUP BY 2
   UNION ALL SELECT 'condo_settings', condominium_id, count(*) FROM condo_settings GROUP BY 2
   ORDER BY 1, 2;
   ```

   NULL `condominium_id` (the columns are `NOT NULL`, so this is redundant, but must return `0`):

   ```sql
   SELECT (SELECT count(*) FROM apartments WHERE condominium_id IS NULL)
        + (SELECT count(*) FROM residents WHERE condominium_id IS NULL)
        + (SELECT count(*) FROM accounts WHERE condominium_id IS NULL)
        + (SELECT count(*) FROM receipts WHERE condominium_id IS NULL)
        + (SELECT count(*) FROM notices WHERE condominium_id IS NULL)
        + (SELECT count(*) FROM threads WHERE condominium_id IS NULL)
        + (SELECT count(*) FROM categories WHERE condominium_id IS NULL)
        + (SELECT count(*) FROM incomes WHERE condominium_id IS NULL)
        + (SELECT count(*) FROM condo_settings WHERE condominium_id IS NULL) AS null_rows;
   ```

   Legacy membership mismatches (every query must return **0 rows**):

   ```sql
   -- resident users without an active morador role in condo-legacy
   SELECT u.username FROM users u
   JOIN residents r ON r.id = u.resident_id
   WHERE u.role = 'resident'
     AND NOT EXISTS (
       SELECT 1 FROM condo_roles c
       WHERE c.user_id = u.id AND c.condominium_id = 'condo-legacy'
         AND c.role = 'morador' AND c.active
     );

   -- admin users without an owner row in org-legacy
   SELECT u.username FROM users u
   WHERE u.role = 'admin'
     AND NOT EXISTS (
       SELECT 1 FROM organization_members m
       WHERE m.user_id = u.id AND m.organization_id = 'org-legacy'
         AND m.role = 'owner' AND m.active
     );

   -- admin users without an administrador row in condo-legacy
   SELECT u.username FROM users u
   WHERE u.role = 'admin'
     AND NOT EXISTS (
       SELECT 1 FROM condo_roles c
       WHERE c.user_id = u.id AND c.condominium_id = 'condo-legacy'
         AND c.role = 'administrador' AND c.active
     );
   ```

## Accounts and invitations (migrations 019–023)

Migrations `019`–`023` add e-mail identity to `users`, `auth_tokens`, `session_version`
and `invitations`. They run on release, so take a `pg_dump` first as above. Before
merging, set the e-mail secrets above and the owner-email step after the deploy.

- **All existing sessions are invalidated on deploy.** The session JWT now carries
  `sv` and tokens without it are rejected, so everyone logs in once.
- Legacy logins keep working (and keep the admin "Redefinir senha") until the resident
  accepts an invitation, which retires the derived login for that condominium.
- Derived-login provisioning (`POST /api/condos/:id/users`) is gone; residents are
  invited instead.
- Rollback = restore the `pg_dump` (the old code cannot read `username`-less rows).

## CI auto-deploy

`.github/workflows/deploy.yml` (API → Fly) and `deploy-web.yml` (web → Cloudflare
Pages) both trigger on a green **CI** run on `main` and on manual dispatch.

GitHub repo secrets (`Lucantas/morada-app`):

| Secret                  | Set by                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `FLY_API_TOKEN`         | `fly tokens create deploy -a morada-api`                                            |
| `CLOUDFLARE_ACCOUNT_ID` | `wrangler whoami`                                                                   |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare dashboard → My Profile → API Tokens → **Edit Cloudflare Pages** template |

> **Rotate `CLOUDFLARE_API_TOKEN` before the next merge to `main`.** It was found
> invalid on 2026-10-23: `deploy-web.yml` failed while the API deployed. Until it is
> rotated (Cloudflare dashboard → My Profile → API Tokens → **Edit Cloudflare Pages**,
> then update the GitHub secret), a merge deploys the API but not the web, and
> production breaks. Manual fallback:
>
> ```bash
> VITE_API_URL='' pnpm --filter @morada/web build
> pnpm dlx wrangler@4 pages deploy apps/web/dist --project-name=morada --branch=main
> ```

## Roles, activity and Pix release

Migrations `024` (`activity_log`), `025` (staff invitations) and `026` (Pix columns on
`condo_settings`) are non-destructive: `025` drops the `NOT NULL` on
`invitations.resident_id`/`condominium_id` and replaces the role `CHECK`, but no data is
removed and existing rows stay valid. The Fly `release_command` applies them on the next
deploy. No new secrets are needed.

Rollback: once síndico or membro invitation rows exist, the SP2 build cannot parse them,
so do not roll back to it; restore the pre-deploy database dump instead.

Manual `wrangler pages deploy` runs leave `.wrangler/` bundles at the repo root; the
directory is git-ignored.

## Building and onboarding release

Migration `027_building` is additive: it adds `apartments.block/floor/position/active`
(existing apartments are placed by the `Apto <n>` rule and stay `active`), the opening
balance columns on `condo_settings` (null) and `condominiums.onboarded_at`. Existing
condominiums are backfilled with `now()`, so no one already in production sees the
onboarding. The Fly `release_command` applies it on the next deploy; no new secrets.

Take the usual Neon `pg_dump` before merging (see Database backup & restore); rollback is
restoring that dump.

## Verify

```bash
curl -fsS https://morada-api.fly.dev/healthz        # -> {"status":"ok"}
curl -fsS https://morada-a6g.pages.dev/ | head      # web serves
```

## JWT secret rotation

The API verifies access tokens with a single `JWT_SECRET`. Rotating it invalidates
every live token immediately (8 h access token). There is no dual-secret grace
window yet — rotate during low traffic.
