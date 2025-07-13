# Makefile for Waltodo Docker operations

.PHONY: help build up down test test-quick test-clean logs shell clean dev dev-up dev-down

# Default target
help:
	@echo "Waltodo Docker Management"
	@echo "========================"
	@echo ""
	@echo "Production Commands:"
	@echo "  make build       - Build Docker image"
	@echo "  make up          - Start containers"
	@echo "  make down        - Stop containers"
	@echo "  make logs        - View container logs"
	@echo "  make shell       - Open shell in container"
	@echo ""
	@echo "Testing Commands:"
	@echo "  make test        - Run full E2E test suite"
	@echo "  make test-quick  - Run tests without rebuild"
	@echo "  make test-clean  - Clean and run tests"
	@echo ""
	@echo "Development Commands:"
	@echo "  make dev         - Start development environment"
	@echo "  make dev-up      - Start dev containers"
	@echo "  make dev-down    - Stop dev containers"
	@echo ""
	@echo "Maintenance Commands:"
	@echo "  make clean       - Remove containers and volumes"

# Production commands
build:
	@echo "Building Waltodo Docker image..."
	@docker-compose -f docker-compose.yml build

up:
	@echo "Starting Waltodo containers..."
	@docker-compose -f docker-compose.yml up -d
	@echo "Containers started. Run 'make logs' to view logs."

down:
	@echo "Stopping Waltodo containers..."
	@docker-compose -f docker-compose.yml down

logs:
	@docker-compose -f docker-compose.yml logs -f

shell:
	@echo "Opening shell in Waltodo container..."
	@docker exec -it waltodo-app /bin/sh

# Testing commands
test:
	@echo "Running E2E test suite..."
	@./run-e2e-tests.sh

test-quick:
	@echo "Running E2E tests without rebuild..."
	@./run-e2e-tests.sh --skip-build

test-clean:
	@echo "Cleaning and running E2E tests..."
	@./run-e2e-tests.sh --clean

# Development commands
dev:
	@echo "Starting development environment..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build

dev-up:
	@echo "Starting development containers..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

dev-down:
	@echo "Stopping development containers..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml down

# Maintenance commands
clean:
	@echo "Cleaning up containers and volumes..."
	@docker-compose -f docker-compose.yml down -v
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml down -v
	@echo "Cleanup complete."

# Container operations
exec:
	@docker exec -it waltodo-app node /app/dist/index.js $(ARGS)

# Example usage targets
example-add:
	@echo "Adding example TODO..."
	@docker exec -it waltodo-app node /app/dist/index.js add "Example TODO from Makefile"

example-list:
	@echo "Listing TODOs..."
	@docker exec -it waltodo-app node /app/dist/index.js list

# Health check
health:
	@echo "Checking container health..."
	@docker ps --filter name=waltodo
	@docker exec waltodo-app node -e "console.log('Container is healthy')" || echo "Container is not running"