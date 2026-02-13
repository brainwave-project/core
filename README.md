# Core Microservice

The **Core** library provides shared functionality and utilities for the microservices ecosystem (AuthHub, UserHub, KnowHub). It includes configuration management, logging, database connections, and common helpers.

---

## Table of Contents

* [Overview](#overview)
* [Features](#features)
* [Getting Started](#getting-started)
* [Configuration](#configuration)
* [Running Locally](#running-locally)
* [Docker](#docker)
* [CI/CD & Release](#cicd--release)
* [Project Structure](#project-structure)
* [Contributing](#contributing)
* [License](#license)

---

## Overview

Core provides:

* Centralized configuration and environment handling (`config.dev.ts`, `config.prod.ts`)
* Logging utilities (structured JSON logs)
* Database connection utilities for PostgreSQL
* Shared TypeScript types and helpers
* Base classes and functions for consistent error handling

All services in the ecosystem import Core to avoid duplicating boilerplate.

---

## Features

* Environment-based configuration
* Connection pooling for PostgreSQL
* Standardized logging via structured JSON (Serilog/Pino inspired)
* Utilities for consistent API responses and error handling
* Lightweight and dependency-free
* Ready for Dockerized environments

---

## Getting Started

### Prerequisites

* Node.js >= 20
* npm >= 9
* PostgreSQL instance
* Docker (optional, for containerized development)

### Install Dependencies

```bash
npm install
```

---

## Configuration

Environment variables are handled via `.env` and `config` files.

Example `.env`:

```
NODE_ENV=development
DATABASE_URL=postgres://user:password@localhost:5432/core_db
PORT=3000
```

Core loads config from:

* `config.dev.ts` → `NODE_ENV=development`
* `config.prod.ts` → `NODE_ENV=production`

> Secrets and sensitive information should never be committed. Use environment variables or a vault for production.

---

## Running Locally

Start the development server:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Lint & format:

```bash
npm run lint
npm run format
```

---

## Docker

Build and run Core using Docker:

```bash
docker build -t core-service .
docker run -p 3000:3000 --env-file .env core-service
```

Docker Compose (if using multiple services):

```yaml
version: '3.9'
services:
  core:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
```

---

## CI/CD & Release

* GitHub Actions workflow: `.github/workflows/release.yml`
* Semantic Release handles automatic versioning and GitHub releases based on **Conventional Commits**
* Make commits using the pattern:

```
feat: new feature → minor version bump
fix: bug fix → patch version bump
feat!: breaking change → major version bump
```

> Only commits following this pattern trigger a release.

---

## Project Structure

```
core/
├─ src/
│  ├─ config/
│  │  ├─ config.dev.ts
│  │  └─ config.prod.ts
│  ├─ db/
│  │  └─ index.ts          # DB connection
│  ├─ utils/
│  │  └─ logger.ts         # Logging utilities
│  └─ index.ts             # Entry point
├─ tests/                  # Unit & integration tests
├─ .eslintrc
├─ .prettierrc
├─ package.json
├─ tsconfig.json
├─ release.config.cjs
└─ README.md
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make commits using **Conventional Commits**
4. Push the branch and create a pull request
5. Ensure tests pass and linting is clean

---

## License

MIT License © 2026 Ahmad
