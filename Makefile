.DEFAULT_GOAL := help
.PHONY: help up test coverage e2e

help: ## list the targets
	@grep -E '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "make %-10s %s\n", $$1, $$2}'

up: ## docker compose up --build
	docker compose up --build

frontend/node_modules: frontend/package-lock.json
	cd frontend && npm ci

test: frontend/node_modules ## backend: go vet + go test; frontend: eslint, tsc, vitest
	cd backend && go vet ./... && go test ./...
	cd frontend && npm run lint && npm run typecheck && npm test

coverage: frontend/node_modules ## backend: go test -coverprofile + go tool cover; frontend: vitest --coverage
	cd backend && go test -coverprofile=coverage.out ./... && go tool cover -func=coverage.out
	cd frontend && npm run coverage

e2e/node_modules: e2e/package-lock.json
	cd e2e && npm ci

e2e: e2e/node_modules ## docker compose up, playwright test, docker compose down
	docker compose up --build --detach --wait
	cd e2e && npm test; status=$$?; docker compose down; exit $$status
