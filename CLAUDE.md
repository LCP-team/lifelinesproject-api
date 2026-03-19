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

## Domain Model

### User roles

| Role        | Description                                                |
| ----------- | ---------------------------------------------------------- |
| `CLIENT`    | Person seeking support; can browse the lifeliner directory |
| `LIFELINER` | Volunteer mental health provider listed in the directory   |

### Auth provider design

Authentication uses an **`AuthProvider` table** rather than storing provider IDs directly on `User`. This decouples identity from auth, so a single user can link multiple OAuth providers and new providers can be added without touching the `users` table.

```
User 1 ──< AuthProvider (provider=GOOGLE, provider_id="sub-from-google")
           AuthProvider (provider=GITHUB, ...)   ← future, no schema change needed
```

**Login flow:**
1. Receive OAuth callback → look up `AuthProvider` by `(provider, provider_id)`
2. If found → return the linked `User`
3. If not found → create `User` + `AuthProvider` (or link to existing `User` by email)

`onDelete: Cascade` on `AuthProvider.user_id` — deleting a user removes all their provider links.

Current providers: `GOOGLE`. Add new values to the `AuthProviderType` enum to support more.

### Lifeliner profile

A `Lifeliner` record is a one-to-one extension of `User` (created after registration).

| Field             | Type         | Notes                                              |
| ----------------- | ------------ | -------------------------------------------------- |
| `full_name`       | String       | Legal name — not public                            |
| `display_name`    | String       | Shown publicly in the directory                    |
| `age`             | Int          | Lifeliner's own age                                |
| `private_picture` | String (URL) | Verification photo — **never exposed to clients**  |
| `profile_picture` | String (URL) | Public photo shown in the directory                |
| `about_me`        | String       | Bio displayed on public profile                    |
| `age_groups`      | `AgeGroup[]` | Age groups the lifeliner is comfortable supporting |

`onDelete: Cascade` on `Lifeliner.user_id` — deleting a user removes their profile.

### AgeGroup enum

| Value          | Label                |
| -------------- | -------------------- |
| `TEENS`        | Teens (13–17)        |
| `YOUNG_ADULTS` | Young Adults (18–25) |
| `ADULTS`       | Adults (26–64)       |
| `SENIORS`      | Seniors (65+)        |

`age_groups` is stored as a PostgreSQL array on the `lifeliners` table.

## Database (Prisma)

**ORM:** Prisma v7
**Database:** PostgreSQL
**Schema:** `prisma/schema.prisma`
**Generated client output:** `generated/prisma/` (not committed)

### Common commands

```bash
# After changing schema.prisma
npx prisma migrate dev --name <migration-name>   # create & apply migration (dev)
npx prisma migrate deploy                         # apply pending migrations (prod)
npx prisma generate                               # regenerate the Prisma client

# Inspect / seed
npx prisma studio                                 # open browser-based DB GUI
npx prisma db seed                                # run seed script (if configured)
npx prisma db push                                # push schema without migration (prototyping only)
```

### Usage in NestJS

Wrap the Prisma client in an injectable `PrismaService` that extends `PrismaClient` and calls `$connect()` in `onModuleInit`. Provide it in a shared `PrismaModule` and import that module wherever database access is needed. Inject `PrismaService` directly into feature services — do not instantiate `PrismaClient` elsewhere.

```typescript
// Example
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

The `DATABASE_URL` environment variable must be set (standard Prisma / PostgreSQL connection string).

## Code Style

- Single quotes, trailing commas (Prettier)
- ESLint uses flat config (`eslint.config.mjs`) with TypeScript type-checking enabled
- `@typescript-eslint/no-explicit-any` is disabled; floating promises and unsafe arguments emit warnings
