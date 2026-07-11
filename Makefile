.DEFAULT_GOAL := help
WEB = pnpm --filter @morada/web

.PHONY: help install dev build test test-watch coverage typecheck lint format format-check check clean

help: ## List targets
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install deps (also installs git hooks via lefthook)
	pnpm install

dev: ## Start the Vite dev server
	$(WEB) dev

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

check: typecheck lint format-check coverage ## Run everything the git hooks run

clean: ## Remove caches and coverage output
	rm -rf apps/web/coverage apps/web/dist node_modules/.cache
