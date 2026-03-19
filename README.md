# Lifelines Project API

REST API backend for the Lifelines Project — a directory of volunteer mental health providers connecting people in need with compassionate listeners.

## Overview

The platform supports two user roles:

- **Clients** — people seeking mental health support who can browse and connect with lifeliners
- **Lifeliners** — volunteer mental health providers listed in the directory

Authentication is handled via Google OAuth.

## Setup

```bash
npm install
```

## Running

```bash
npm run start:dev    # development with hot reload
npm run start:prod   # production (requires npm run build first)
```

Server listens on `PORT` env variable, defaults to `3000`.

## Testing

```bash
npm run test         # unit tests
npm run test:e2e     # end-to-end tests
npm run test:cov     # unit tests with coverage
```

## Linting

```bash
npm run lint         # ESLint with auto-fix
npm run format       # Prettier
```
