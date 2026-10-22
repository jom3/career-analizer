# AGENTS.md

Career Analyzer: AI-powered job-search SaaS (candidate profile, CV import/analysis, job matching, tailored CV, cover letters). npm workspaces monorepo: `backend/` (NestJS) and `frontend/` (Angular). Product vision is in `README.md`; detailed behavior lives in `specs/`.

## Business invariants (non-negotiable)

- The **Candidate Profile** is the single source of truth. Imported CVs build it; generated CVs, cover letters and other documents derive from it.
- AI **must never invent** experience, skills, companies, positions, certifications, education, projects, or achievements.
- ATS optimization is not keyword stuffing. Output must stay natural, professional, specific, human-sounding.
- Spanish and English. Interface language and document language are independent. Translation is natural professional adaptation, not literal translation.
- Keep AI-generated information distinguishable from user-provided information.

## Workflow

- Spec-driven: each feature has `specs/NN-slug.md` with a `> **Status:**` line (`Approved` → `Implemented`). Implement only from an Approved spec.
- Branches: `spec-NN-slug`, merged via PR. `specs/.spec-config.yml` sets `AutoCreateBranch`.
- Commits: Conventional Commits (`feat(backend): ...`, `docs(spec): marcar SPEC NN Implemented`).

## Commands

Run from the repo root unless noted. Use `-w <workspace>` to target a package: `career-analyzer-backend` or `career-analyzer-frontend`.

- Install: `npm install` at the root only. Never run `npm install` inside `backend/` or `frontend/`; the backend Jest config resolves `../node_modules`.
- Prisma client is generated into `backend/src/generated/prisma` (gitignored). Run `npm run prisma:generate -w career-analyzer-backend` after clone and after every `schema.prisma` change, before build or tests.
- New migration (needs DB reachable): `npm run prisma:migrate -w career-analyzer-backend -- --name <snake_case_name>`. The `career_analyzer` role needs `CREATEDB` (Prisma shadow database).
- Dev servers: `npm run start:backend` (port 3000, watch mode), `npm run start:frontend` (port 4200, proxies `/api`).
- Build: `npm run build:all`. Lint: `npm run lint:all`. Backend lint runs ESLint with `--fix`, so it rewrites files. Backend formatting: `npm run format -w career-analyzer-backend`.
- Unit tests (backend, Jest, `src/**/*.spec.ts`): `npm run test -w career-analyzer-backend`. Single file or pattern: append `-- <pattern>`, e.g. `npm run test -w career-analyzer-backend -- cv-import.service`.
- E2E (backend, `test/**/*.e2e-spec.ts`): `npm run test:e2e -w career-analyzer-backend`. Single file: append `-- <pattern>`.
- Frontend unit tests (Vitest via Angular `ng test`): `npm run test -w career-analyzer-frontend`.

## Environment

- Two env files, both copied from their `.env.example`:
  - Root `.env`: used by `docker-compose*.yml`. Its `DATABASE_URL` points to `host.docker.internal:5432`.
- PostgreSQL is not part of the compose files. The app uses the host's `local-postgres` container (PostgreSQL 18, port 5432, database and role `career_analyzer`). Keep it running before starting the backend, dev stack, or running migrations.
  - `backend/.env`: used for host runs. `prisma.config.ts` and Nest `ConfigModule` read `.env` from the package directory (npm `-w` runs there).
- Backend refuses to boot without `OPENAI_API_KEY` and `JWT_SECRET` (min 32 chars); validation is in `backend/src/app.module.ts`. E2E tests import `AppModule`, so they need these too.
- E2E tests run against the `DATABASE_URL` database and write rows (users use timestamped emails). That database now holds real user data, so do not run e2e against it.
- `MAIL_DRIVER=log` (default) does not send email; reset links are logged to the console.

## Docker

- Dev: `npm run docker:up` (drops the `node_modules` volumes, then rebuilds). Frontend at `localhost:4200`, backend at `localhost:3000`.
- Prod: `npm run docker:prod:up`. Single origin via nginx at `localhost:8080`.
- Migrations are never automatic. Run `docker compose exec backend npx prisma migrate deploy` (dev) or `docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy` (prod).

## Architecture

- Backend: one NestJS module per feature in `backend/src/` (`auth`, `profile`, `cv-import`, `cv-adaptation`, `cv-export`, `job-analysis`, `job-match`, `cover-letter`). Cross-cutting: `prisma`, `openai` (global), `mail`, `i18n` (`Accept-Language` drives generated content language).
- Auth: a global guard (`APP_GUARD` in `auth.module.ts`) requires JWT on every route. Mark public routes with `@Public()`.
- API paths have no `/api` prefix in Nest. The frontend calls `/api/...`, and the dev proxy (`frontend/proxy.conf.js`) and nginx (`frontend/nginx.conf`) strip it.
- Frontend: standalone Angular components by feature folder in `frontend/src/app/`. Shared services and models are in `src/app/core/`. UI strings live in `src/app/core/i18n/es.ts` and `en.ts`; add every key to both, since dictionary specs check this.
- Prisma schema: `backend/prisma/schema.prisma`, with migrations in `backend/prisma/migrations/`.
- `backend/src/scripts/` contains one-off data scripts that touch the database. Do not run them casually.
