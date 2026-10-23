# Trading Journal — common tasks.
#
# The app is a static SPA; every command runs in ./frontend.

FRONTEND := frontend

.DEFAULT_GOAL := build
.PHONY: help install dev build preview test lint check clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

install: ## Install frontend dependencies
	cd $(FRONTEND) && pnpm install

dev: ## Start the Vite dev server on http://localhost:5173
	cd $(FRONTEND) && pnpm dev

build: ## Type-check and build the production SPA into frontend/dist
	cd $(FRONTEND) && pnpm build

preview: ## Preview the production build locally
	cd $(FRONTEND) && pnpm preview

test: ## Run the unit tests
	cd $(FRONTEND) && pnpm test

lint: ## Run ESLint
	cd $(FRONTEND) && pnpm lint

check: lint test build ## Run lint, tests, and a production build

clean: ## Remove build output and dependencies
	rm -rf $(FRONTEND)/dist $(FRONTEND)/node_modules
