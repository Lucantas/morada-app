.DEFAULT_GOAL := help

# API_PORT drives BOTH the API's listen port and the URL the web app targets, so
# `make start API_PORT=9090` moves the whole stack off a taken 8787.
API_PORT ?= 8787
WEB_PORT ?= 5173
API_URL = http://localhost:$(API_PORT)
WEB = pnpm --filter @morada/web
API = pnpm --filter @morada/api

# LAN mode (test on a phone on the same Wi-Fi). Best-effort auto-detect of the
# machine's LAN IPv4, skipping docker bridges (172.16-31.x). Override: make start-lan LAN_IP=192.168.0.155
LAN_IP ?= $(shell ip -4 addr show scope global 2>/dev/null | grep -oP 'inet \K[\d.]+' | grep -vE '^172\.(1[6-9]|2[0-9]|3[0-1])\.' | head -1)

# The API runs on Postgres. Point DATABASE_URL elsewhere to use another database;
# it defaults to the local docker Postgres from `make db-up`.
DB_URL ?= postgres://morada:morada@localhost:5433/morada
DATABASE_URL ?= $(DB_URL)
export DATABASE_URL

# Tests TRUNCATE + reseed their database, so they run against an ISOLATED
# `morada_test` DB — never the app's `morada` data. Nothing auto-reseeds `morada`.
TEST_DB_URL ?= postgres://morada:morada@localhost:5433/morada_test

.PHONY: help install start start-lan start-tunnel start-backend start-app build test test-watch coverage typecheck lint format format-check check reset-db clean api-dev api-test api-typecheck api-lint api-check db-up db-down spec-gate

help: ## List targets
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies (also installs git hooks via lefthook)
	pnpm install

start: db-up ## Start the API (Postgres) + web together; Ctrl-C stops both
	@echo "==> Morada API on :$(API_PORT) + web on :$(WEB_PORT) (Ctrl-C stops both)"
	@PORT=$(API_PORT) $(API) dev & \
		API_PID=$$!; \
		trap 'pkill -P $$API_PID 2>/dev/null; kill $$API_PID 2>/dev/null' INT TERM EXIT; \
		VITE_API_URL=$(API_URL) $(WEB) dev --port $(WEB_PORT) --strictPort

start-lan: db-up ## Start API+web bound to the LAN so a phone on the same Wi-Fi can reach them (override LAN_IP=...)
	@test -n "$(LAN_IP)" || { echo "Could not detect LAN_IP — run: make start-lan LAN_IP=192.168.x.x"; exit 1; }
	@echo "==> LAN mode — open http://$(LAN_IP):$(WEB_PORT) on your phone (same Wi-Fi). Ctrl-C stops both."
	@PORT=$(API_PORT) WEB_ORIGIN=http://$(LAN_IP):$(WEB_PORT) $(API) dev & \
		API_PID=$$!; \
		trap 'pkill -P $$API_PID 2>/dev/null; kill $$API_PID 2>/dev/null' INT TERM EXIT; \
		VITE_API_URL=http://$(LAN_IP):$(API_PORT) $(WEB) dev --host --port $(WEB_PORT) --strictPort

start-tunnel: db-up ## Expose the stack over a public HTTPS cloudflared tunnel (phone on ANY network); prints the URL
	@command -v cloudflared >/dev/null 2>&1 || { echo "cloudflared not found. Install: curl -fL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o ~/.local/bin/cloudflared && chmod +x ~/.local/bin/cloudflared"; exit 1; }
	@echo "==> Tunnel mode — open the https://<...>.trycloudflare.com URL printed below on your phone. Ctrl-C stops everything."
	@PORT=$(API_PORT) $(API) dev & API_PID=$$!; \
		VITE_API_URL= API_PROXY_TARGET=http://localhost:$(API_PORT) $(WEB) dev --port $(WEB_PORT) --strictPort & WEB_PID=$$!; \
		trap 'pkill -P $$API_PID 2>/dev/null; pkill -P $$WEB_PID 2>/dev/null; kill $$API_PID $$WEB_PID 2>/dev/null' INT TERM EXIT; \
		sleep 4; \
		cloudflared tunnel --url http://localhost:$(WEB_PORT)

start-backend: db-up ## Start only the API (Postgres) on :$(API_PORT)
	PORT=$(API_PORT) $(API) dev

start-app: ## Start only the web app (:$(WEB_PORT)) pointed at the live API
	VITE_API_URL=$(API_URL) $(WEB) dev --port $(WEB_PORT) --strictPort

build: ## Production build (web)
	$(WEB) build

test: ## Run the web test suite
	$(WEB) test

test-watch: ## Run web tests in watch mode
	$(WEB) test --watch

coverage: ## Run web tests with coverage (gate = 80%)
	$(WEB) test:coverage

typecheck: ## Type-check the web app with tsc
	$(WEB) typecheck

lint: ## Run ESLint on the web app (includes architecture boundaries)
	$(WEB) lint

format: ## Format all files with Prettier (repo-wide)
	pnpm format

format-check: ## Check formatting without writing (repo-wide)
	pnpm format:check

check: typecheck lint format-check coverage ## Run every web gate (what the hooks run)

reset-db: db-up ## Wipe the local Postgres so the next start re-migrates + seeds fresh
	docker exec morada-postgres psql -U morada -d morada -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

clean: ## Remove caches and coverage output
	rm -rf apps/web/coverage apps/web/dist node_modules/.cache

api-dev: db-up ## Start only the API (alias of start-backend)
	PORT=$(API_PORT) $(API) dev

api-test: db-up ## Run API tests with coverage (gate = 80%) against an ISOLATED test DB (never the app data)
	@docker exec morada-postgres psql -U morada -d morada -tAc "SELECT 1 FROM pg_database WHERE datname='morada_test'" | grep -q 1 \
		|| docker exec morada-postgres psql -U morada -d morada -c "CREATE DATABASE morada_test"
	DATABASE_URL=$(TEST_DB_URL) $(API) test:coverage

api-typecheck: ## Type-check the API with tsc
	$(API) typecheck

api-lint: ## Run ESLint on the API (includes architecture boundaries)
	$(API) lint

api-check: api-typecheck api-lint api-test ## Run every API gate

db-up: ## Start the local Postgres (docker compose) the API + tests run against
	docker compose up -d --wait

db-down: ## Stop the local Postgres
	docker compose down

spec-gate: ## Check the pushed range for spec trailers
	node scripts/check-spec-trailer.mjs --range origin/main..HEAD
