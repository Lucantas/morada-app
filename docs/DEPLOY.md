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
  `dist/migrate-main.js`). No native dependencies, so the runtime image is a plain
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

## CI auto-deploy

`.github/workflows/deploy.yml` (API → Fly) and `deploy-web.yml` (web → Cloudflare
Pages) both trigger on a green **CI** run on `main` and on manual dispatch.

GitHub repo secrets (`Lucantas/morada-app`):

| Secret                  | Set by                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `FLY_API_TOKEN`         | `fly tokens create deploy -a morada-api`                                            |
| `CLOUDFLARE_ACCOUNT_ID` | `wrangler whoami`                                                                   |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare dashboard → My Profile → API Tokens → **Edit Cloudflare Pages** template |

## Verify

```bash
curl -fsS https://morada-api.fly.dev/healthz        # -> {"status":"ok"}
curl -fsS https://morada-a6g.pages.dev/ | head      # web serves
```

## JWT secret rotation

The API verifies access tokens with a single `JWT_SECRET`. Rotating it invalidates
every live token immediately (8 h access token). There is no dual-secret grace
window yet — rotate during low traffic.
