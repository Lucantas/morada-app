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
