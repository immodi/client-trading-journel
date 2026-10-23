# Trading Journal — common tasks.
#
# The app is a static SPA; every command runs at the repository root.

.DEFAULT_GOAL := build
.PHONY: help install dev build preview test lint check clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

install: ## Install frontend dependencies
	pnpm install

dev: ## Start the Vite dev server on http://localhost:5173
	pnpm dev

build: ## Type-check and build the production SPA into dist
	pnpm build

preview: ## Preview the production build locally
	pnpm preview

test: ## Run the unit tests
	pnpm test

lint: ## Run ESLint
	pnpm lint

check: lint test build ## Run lint, tests, and a production build

clean: ## Remove build output and dependencies
	rm -rf dist node_modules
