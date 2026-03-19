# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Lifelines Project API** — a REST API for a directory of volunteer mental health providers. Users can register and authenticate via Google OAuth in one of two roles:

- **Client** — someone seeking mental health support; can browse the lifeliner directory
- **Lifeliner** — a volunteer mental health provider listed in the directory

## Commands

```bash
# Development
npm run start:dev       # Start with hot reload (watch mode)
npm run start:debug     # Start with Node.js debugger

# Build
npm run build           # Compile TypeScript to dist/

# Production
npm run start:prod      # Run compiled build from dist/main

# Testing
npm run test            # Unit tests (*.spec.ts in src/)
npm run test:watch      # Unit tests in watch mode
npm run test:cov        # Unit tests with coverage
npm run test:e2e        # E2E tests (*.e2e-spec.ts in test/)
npm run test:debug      # Unit tests with Node.js inspector

# Linting / Formatting
npm run lint            # ESLint with --fix on src/, apps/, libs/, test/
npm run format          # Prettier on src/ and test/
```

To run a single test file:
```bash
npx jest src/app.controller.spec.ts
npx jest --testPathPattern="app.controller"
```

## Architecture

This is a **NestJS 11** REST API using TypeScript. The framework follows an Angular-inspired modular architecture with decorators and dependency injection.

**Core patterns:**
- **Modules** (`*.module.ts`) — organize and wire together controllers and providers
- **Controllers** (`*.controller.ts`) — handle HTTP routing; delegate logic to services
- **Services** (`*.service.ts`) — business logic, marked `@Injectable()` for the DI container
- **Providers** — any class decorated with `@Injectable()` that can be injected

**Module wiring:** Each feature is a NestJS module. The root `AppModule` in `src/app.module.ts` is the composition root — it imports all feature modules and is bootstrapped in `src/main.ts`.

**Server port:** Reads from `PORT` env variable, defaults to `3000`.

**Test setup:** Unit tests use `@nestjs/testing`'s `Test.createTestingModule()` to build isolated module instances. E2E tests in `test/` spin up the full application with supertest.

## Code Style

- Single quotes, trailing commas (Prettier)
- ESLint uses flat config (`eslint.config.mjs`) with TypeScript type-checking enabled
- `@typescript-eslint/no-explicit-any` is disabled; floating promises and unsafe arguments emit warnings
