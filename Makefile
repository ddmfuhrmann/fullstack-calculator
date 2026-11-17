.DEFAULT_GOAL := help
.PHONY: help test coverage

help: ## list the targets
	@grep -E '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "make %-10s %s\n", $$1, $$2}'

test: ## backend: go vet + go test
	cd backend && go vet ./... && go test ./...

coverage: ## backend: go test -coverprofile + go tool cover -func
	cd backend && go test -coverprofile=coverage.out ./... && go tool cover -func=coverage.out
