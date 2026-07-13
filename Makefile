.DEFAULT_GOAL := help

# API_PORT drives BOTH the API's listen port and the URL the web app targets, so
# `make start API_PORT=9090` moves the whole stack off a taken 8787.
API_PORT ?= 8787
WEB_PORT ?= 5173
API_URL = http://localhost:$(API_PORT)
WEB = pnpm --filter @morada/web
API = pnpm --filter @morada/api

.PHONY: help install start start-backend start-app build test test-watch coverage typecheck lint format format-check check reset-db clean api-dev api-test api-typecheck api-lint api-check

help: ## List targets
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies (also installs git hooks via lefthook)
	pnpm install

start: ## Start the API + web (wired to the API) together; Ctrl-C stops both
	@echo "==> Morada API on :$(API_PORT) + web on :$(WEB_PORT) (Ctrl-C stops both)"
	@PORT=$(API_PORT) $(API) dev & \
		API_PID=$$!; \
		trap 'pkill -P $$API_PID 2>/dev/null; kill $$API_PID 2>/dev/null' INT TERM EXIT; \
		VITE_API_URL=$(API_URL) $(WEB) dev --port $(WEB_PORT) --strictPort

start-backend: ## Start only the API (SQLite) on :$(API_PORT)
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

reset-db: ## Delete the local SQLite DB so the next start seeds fresh (admin only)
	rm -f apps/api/morada.db apps/api/morada.db-wal apps/api/morada.db-shm

clean: ## Remove caches and coverage output
	rm -rf apps/web/coverage apps/web/dist node_modules/.cache

api-dev: ## Start only the API (alias of start-backend)
	PORT=$(API_PORT) $(API) dev

api-test: ## Run API tests with coverage (gate = 80%)
	$(API) test:coverage

api-typecheck: ## Type-check the API with tsc
	$(API) typecheck

api-lint: ## Run ESLint on the API (includes architecture boundaries)
	$(API) lint

api-check: api-typecheck api-lint api-test ## Run every API gate
