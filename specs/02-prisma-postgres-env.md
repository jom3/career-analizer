# SPEC 02 — Prisma + PostgreSQL + variables de entorno en el backend

> **Status:** Implemented
> **Depends on:** SPEC 01
> **Date:** 2026-08-07
> **Objective:** Configurar en el backend NestJS la integración inicial con Prisma (client sin modelos), la conexión a una PostgreSQL de desarrollo vía Docker y la gestión de variables de entorno con `@nestjs/config`.

## Scope

**In:**

- Variables de entorno gestionadas con `@nestjs/config` (módulo global) y archivo `backend/.env` (más plantilla `backend/.env.example`).
- Prisma: `backend/prisma/schema.prisma` **sin modelos**, solo bloques `generator client` y `datasource db` (postgresql con `DATABASE_URL`). Implementado con **Prisma 7** (provider `prisma-client`, `moduleFormat = "cjs"`), `prisma.config.ts` con la `url` y client generado en `backend/src/generated/prisma` (gitignored).
- `prisma generate` para generar el `PrismaClient` inyectable.
- Integración Nest: `backend/src/prisma/prisma.module.ts` (global) + `backend/src/prisma/prisma.service.ts` (extiende `PrismaClient`).
- PostgreSQL de desarrollo con Docker Compose: `backend/docker-compose.yml` + scripts `up:db` / `prisma:generate`.
- Endpoint de verificación: revisar GET `/health` que use `PrismaService` (`$queryRaw SELECT 1`) y responda 200 si la DB responde.
- Dependencias nuevas en `backend`:`@nestjs/config`, `prisma`, `@prisma/client` y `@prisma/adapter-pg` (driver adapter requerido por Prisma 7).

**Out of scope (para specs futuros):**

- Definición de modelos Prisma y migraciones de esquema de dominio.
- Configuración general de Docker/CI/CD (sale a un spec propio, como marca SPEC 01).
- Cualquier feature de producto que use la DB.
- Config de base de datos de producción (solo desarrollo).

## Data model

Este spec no introduce modelos de dominio ni tablas. Introduce únicamente la conexión a la base y el `PrismaClient` vacío (sin modelos). Las estructuras de negocio se definirán en specs de features.

## Implementation plan

Cada paso deja el sistema funcional y compilable.

1. En `backend/`: instalar `@nestjs/config`, `prisma` y `@prisma/client` (devDeps: `prisma`). Crear `backend/.env` con `DATABASE_URL` y `backend/.env.example` con lo mismo (placeholder). El `.gitignore` raíz ya ignora `.env`; `.env.example` queda trackeado.
2. `npx prisma init` (o equivalente) para crear `backend/prisma/schema.prisma` y, sin agregar modelos, dejar solo los bloques `generator client` (provider `prisma-client-js`) y `datasource db` (provider `postgresql`, url `env("DATABASE_URL")`).
3. Crear `backend/src/prisma/prisma.service.ts` (extiende `PrismaClient`, con `onModuleInit`/`onModuleDestroy` de conexión) y `backend/src/prisma/prisma.module.ts` (`@Global()`, exporta `PrismaService`).
4. En `backend/src/app.module.ts`: importar `ConfigModule.forRoot({ isGlobal: true })` y `PrismaModule`. Registrar scripts npm en `backend/package.json`: `prisma:generate` (`prisma generate`) y `up:db` (`docker compose -f docker-compose.yml up -d`).
5. Crear `backend/docker-compose.yml` con la imagen ligera `postgres:18.4-alpine3.24` (en lugar de `postgres:16`), credenciales de desarrollo, puerto `5432` y volumen `pgdata`.
6. Añadir el endpoint de verificación: en `backend/src/app.controller.ts` (o un health controller) un `GET /health` que ejecute `$queryRaw`SELECT 1`` vía `PrismaService` y devuelva `{ status: "ok" }` (200) si la DB responde.
7. Ejecutar `prisma generate` para que exista el client generado y el proyecto compile.

## Acceptance criteria

- [ ] `backend/.env` existe con `DATABASE_URL` y `backend/.env.example` lo refleja sin secretos reales.
- [ ] `backend/prisma/schema.prisma` contiene solo `generator client` y `datasource db` (provider `postgresql`), sin modelos.
- [ ] `npm run prisma:generate` finaliza con éxito y genera el `PrismaClient` en el workspace backend.
- [ ] `PrismaModule` y `PrismaService` existen bajo `backend/src/prisma/` y `PrismaModule` es global.
- [ ] `ConfigModule` está configurado global en `app.module.ts`.
- [ ] `backend/docker-compose.yml` define un servicio de PostgreSQL y `up:db` lo levanta.
- [ ] Con `up:db` activa, `GET http://localhost:3000/health` responde HTTP 200 y cuerpo `{ "status": "ok" }`.
- [ ] `npm run build:all` (root) termina sin errores y `lint:all` con 0 errores en el workspace backend.

## Decisions

- **Sí:** `@nestjs/config` con `ConfigModule` global para leer `.env` de forma tipada e integrada a Nest.
- **Sí:** `PrismaModule` + `PrismaService` (módulo global) para poder inyectar el client en cualquier módulo desde ya.
- **Sí:** schema **sin modelos** (solo `generator` + `datasource`): basta para exponer `PrismaClient`; los modelos son de specs de features.
- **Sí:** PostgreSQL de desarrollo vía `docker-compose.yml` en `backend/`, con `up:db`, para poder verificar la conexión real. El despliegue/producción queda fuera.
- **Sí:** endpoint `GET /health` para verificación operativa de la conexión a DB.
- **No:** modelos, migraciones ni servicios de dominio — pertenecen a specs posteriores.
- **No:** configuración de producción, CI/CD y despliegue Docker general — a specs propios.

## Risks

| Risk                                                        | Mitigation                                                                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `prisma generate` sin modelos podría dudar o fallar según versión | Usar `generator client` + `datasource` mínimo; verificar paso 3 con npm run prisma:generate en el plan.     |
| Puerto `5432` ya usado en la máquina (otra Postgres local)  | Parametrizar el puerto del host en `docker-compose.yml`; el host puede mapearse a `5433`.                    |
| `.env` con credenciales reales en el repo                    | `.env` quedó en `.gitignore`; solo se trackea `.env.example` con valores placeholder.                        |

## What is **not** in this spec

- Modelos Prisma y migraciones. Cada feature que necesite DB define los suyos.
- Config de producción, CI/CD y Docker general.
- Features de producto que usan la base.

Cada uno, si llega, tendrá su propio spec.