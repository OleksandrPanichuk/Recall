SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

ARGS ?=

.PHONY: help install up down dev-api dev-web dev-bot db-up db-down db-reset db-development db-migrate db-generate db-studio backup restore lint typecheck test verify

help: ## List every target with what it does
	@awk 'BEGIN { FS = ":.*## " } /^[a-zA-Z0-9_-]+:.*## / { printf "  %-16s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install: ## Install every workspace dependency
	bun install

up: db-up ## Start Postgres, MinIO and Mailpit, migrate, then run api, bot, web and admin (ARGS forwards flags such as --open)
	bun run up $(ARGS)

down: ## Stop everything up started: the apps, then the containers
	bun run down --db $(ARGS)

dev-api: ## Run only the api from source
	bun run api

dev-web: ## Run only the web app dev server
	bun run web

dev-bot: ## Run only the Telegram bot from source
	bun run dev

db-up: ## Start Postgres, MinIO and Mailpit and wait until they are healthy
	bun run db:up

db-down: ## Stop Postgres, MinIO and Mailpit, keeping their data
	bun run db:down

db-reset: ## Wipe the local database and object store volumes and start them again
	bun run db:reset

db-development: ## Open an interactive psql shell on the local development database
	docker compose exec postgres sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

db-migrate: ## Apply pending drizzle migrations to DATABASE_URL
	bun run db:migrate

db-generate: ## Generate a drizzle migration from schema changes (ARGS forwards flags such as --name)
	bun run db:generate $(ARGS)

db-studio: ## Open drizzle-kit studio on DATABASE_URL
	bun run db:studio

backup: ## Dump Postgres and MinIO into backups/<UTC stamp>
	bun run backup $(ARGS)

restore: ## Put the newest backup back (refuses without ARGS=--yes)
	bun run restore $(ARGS)

lint: ## Run biome lint
	bun run lint

typecheck: ## Typecheck the api tree and the web app
	bun run typecheck

test: ## Run the root suite and the web app suite
	bun run test

verify: ## Check, build, typecheck and test, in that order
	bun run verify
