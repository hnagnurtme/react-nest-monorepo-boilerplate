SHELL := /bin/sh

.DEFAULT_GOAL := help

.PHONY: help install up down stop restart \
	dev start api web \
	format format-check lint typecheck test build verify audit secrets \
	contract db-generate db-migrate db-seed db-studio \
	clean bootstrap reset check ports

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*##"; printf "\nBoilerplate commands\n\n"} /^[a-zA-Z0-9_-]+:.*##/ {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install workspace dependencies from the lockfile
	@just install

up: ## Start local Postgres and Redis
	@just up

down: ## Stop and remove local infrastructure containers
	@just down

stop: ## Stop local infrastructure and dev servers
	@just stop

restart: stop up ## Restart local infrastructure and free dev ports

dev: ## Start all dev servers
	@just dev

start: ## Start built applications
	@just start

api: ## Start the NestJS API dev server
	@just api

web: ## Start the React web dev server
	@just web

format: ## Format source files
	@just format

format-check: ## Check formatting
	@just format-check

lint: ## Run ESLint across workspaces
	@just lint

typecheck: ## Run TypeScript type checks
	@just typecheck

test: ## Run unit and integration tests
	@just test

build: ## Build all workspaces
	@just build

verify: ## Run the full verification suite
	@just verify

audit: ## Run dependency audit
	@just audit

secrets: ## Scan for leaked secrets
	@just secrets

contract: ## Export OpenAPI and regenerate the API contract package
	@just contract

db-generate: ## Generate Drizzle migrations
	@just db-generate

db-migrate: ## Apply database migrations
	@just db-migrate

db-seed: ## Seed development data
	@just db-seed

db-studio: ## Open Drizzle Studio
	@just db-studio

clean: ## Remove build artifacts
	@just clean

bootstrap: install up db-migrate db-seed ## Install deps, start infra, migrate, and seed

reset: down up db-migrate db-seed ## Recreate local infra and reload dev data

check: format-check lint typecheck test build ## Run the fast local quality gate

ports: ## Show processes listening on common dev ports
	@lsof -nP -iTCP:3000 -iTCP:5173 -sTCP:LISTEN || true
