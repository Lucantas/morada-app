.DEFAULT_GOAL := help
WEB = pnpm --filter @morada/web
API = pnpm --filter @morada/api
API_URL ?= http://localhost:8787

.PHONY: help install dev dev-api dev-web start build test test-watch coverage typecheck lint format format-check check check-api clean

help: ## List targets
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install deps (also installs git hooks via lefthook)
	pnpm install

dev: ## Start the Vite dev server (in-memory mode)
	$(WEB) dev

dev-api: ## Start the API (Hono + SQLite) on :8787
	$(API) dev

dev-web: ## Start the web pointed at the live API (run `make dev-api` in another shell first)
	VITE_API_URL=$(API_URL) $(WEB) dev --port 5173 --strictPort

start: ## Start API (:8787) + web (:5173, wired to the live API) together; Ctrl-C stops both
	@echo "▸ API → http://localhost:8787   ▸ Web → http://localhost:5173   (Ctrl-C stops both)"
	@trap 'kill 0' INT TERM EXIT; \
	$(API) dev & \
	VITE_API_URL=$(API_URL) $(WEB) dev --port 5173 --strictPort & \
	wait

build: ## Production build
	$(WEB) build

test: ## Run the test suite
	$(WEB) test

test-watch: ## Tests in watch mode
	$(WEB) test --watch

coverage: ## Tests with coverage (gate = 80%) — same command as the pre-push gate
	$(WEB) test:coverage

typecheck: ## Type-check with tsc
	$(WEB) typecheck

lint: ## ESLint (includes architecture boundaries)
	$(WEB) lint

format: ## Format repo-wide with Prettier
	pnpm format

format-check: ## Check formatting without writing
	pnpm format:check

check: typecheck lint format-check coverage ## Run every web gate (hooks)

check-api: ## Run every API gate
	$(API) typecheck && $(API) lint && $(API) test:coverage

clean: ## Remove caches and coverage output
	rm -rf apps/web/coverage apps/web/dist node_modules/.cache
