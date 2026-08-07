# SPEC 01 — Scaffold del monorepo (backend NestJS + frontend Angular)

> **Status:** Approved
> **Depends on:** —
> **Date:** 2026-08-07
> **Objective:** Inicializar un monorepo npm workspaces que contenga un backend NestJS y un frontend Angular listos para ejecutar, construir y testear desde la raíz.

## Scope

**In:**

- Monorepo con **npm workspaces** y `package.json` raíz con scripts orquestadores (`build:all`, `lint:all`, `test:all`, `start:backend`, `start:frontend`).
- Backend NestJS en `backend/`, con package name `career-analyzer-backend`.
- Frontend Angular en `frontend/`, con package name `career-analyzer-frontend` (standalone, routing, SCSS).
- `git init` en la raíz y commit base.
- Un único `node_modules` y un único lockfile gestionado por npm.

**Out of scope (para specs futuros):**

- Docker, docker-compose e infraestructura de despliegue.
- CI/CD.
- Librerías o paquetes compartidos entre apps.
- Configuración de variables de entorno / config de backend.
- Autenticación, base de datos y persistencia.
- Cualquier feature de producto (perfil, CV, matching, etc.).
- Configuración de librerías de UI (Angular Material / Tailwind / CSS nativo).

## Data model

Este spec no introduce estructuras de datos nuevas. Solo scaffold de proyectos (tooling), sin modelos de dominio.

## Implementation plan

Cada paso deja el repositorio en estado funcional.

1. `git init` en la raíz y crear `.gitignore` (ignorar `node_modules/`, `dist/`, `.angular/`, `.env`, `coverage/`, `.DS_Store`). Crear `package.json` raíz con `"private": true`, `"name": "career-analyzer"`, `"workspaces": ["backend", "frontend"]` y scripts orquestadores vacíos.
2. Scaffold NestJS: `npx @nestjs/cli@latest new backend --package-manager npm --skip-git --skip-install`. Editar su `package.json` para set name `career-analyzer-backend`.
3. Scaffold Angular: `npx @angular/cli@latest new frontend --directory frontend --style scss --routing --defaults --skip-git --skip-install`. Editar su `package.json` para set name `career-analyzer-frontend`.
4. Completar los scripts orquestadores del `package.json` raíz delegando a los workspaces:
   - `build:all`: `npm run build --workspaces --if-present`
   - `lint:all`: `npm run lint --workspaces --if-present`
   - `test:all`: `npm run test --workspaces --if-present`
   - `start:backend`: `npm run start:dev -w career-analyzer-backend`
   - `start:frontend`: `npm run start -w career-analyzer-frontend`
5. Ejecutar `npm install` en la raíz y verificar que se genera un único `node_modules` y `package-lock.json` para ambos workspaces.
6. Commitear el scaffold como commit de base en git.

## Acceptance criteria

- [ ] `git init` realizado y `.gitignore` raíz excluye `node_modules/`, `dist/`, `.angular/`.
- [ ] `package.json` raíz define `workspaces: ["backend", "frontend"]` y `name: "career-analyzer"`.
- [ ] `backend/` es un proyecto NestJS válido con package name `career-analyzer-backend`.
- [ ] `frontend/` es un proyecto Angular válido con package name `career-analyzer-frontend`, standalone, routing y SCSS.
- [ ] Un único `npm install` en la raíz crea un solo `node_modules` y un solo `package-lock.json` para ambas apps.
- [ ] `npm run build:all` termina sin errores para backend y frontend.
- [ ] `npm run lint:all` termina sin errores para backend y frontend.
- [ ] `npm run start:backend` responde en `http://localhost:3000` con la salida por defecto de NestJS (HTTP 200).
- [ ] `npm run start:frontend` responde en `http://localhost:4200` con la app por defecto de Angular.
- [ ] Hay al menos un commit en git con el scaffold.

## Decisions

- **Sí:** npm workspaces en lugar de pnpm/yarn/Nx, ya que alinee con tu AGENTS.md (simplicidad, sin sobre-ingeniería), y no requerimos caché ni generadores unificados para dos apps.
- **Sí:** npm como package manager. Decisión del usuario.
- **Sí:** layout `backend/` + `frontend/` en raíz en vez de `apps/`, por simplicidad.
- **Sí:** comandos orquestadores en el `package.json` raíz para correr build/lint/test/start desde un solo punto.
- **Sí:** frontend con routing y SCSS.
- **Sí:** `git init` y commit de base incluidos en este spec, para habilitar ramas y commits en `/spec-impl`.
- **No:** Docker, CI/CD, librerías compartidas, configuración de envío y features de producto — quedan fuera del alcance y requieren spec propio si llegan.
- **No:** librerías de UI (Material / Tailwind) en el scaffold — se decide en un spec de UI aparte.
- **Sí:** aceptar `node_modules` anidados dentro de un workspace cuando existan conflictos de versión que impidan el hoisting (ej.: backend TS ~5.9 vs frontend TS ~6). Es el comportamiento estándar de npm; "un solo node_modules" se interpreta como un solo install y un solo lockfile en la raíz, no como ausencia total de anidamientos.

## Risks

| Risk                                             | Mitigation                                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `nest new` / `ng new` generan un `.git` anidado | Usar `--skip-git` en ambos scaffolders; mantener un solo repo raíz.                    |
| Versiones latest inestables al momento del scaffold | Comprometer el `package-lock.json` y registrar la versión de Angular/Nest al commitear. |
| Test de frontend vía Karma puede fallar en CI sin navegador | Los criterios de aceptación prueban build + serve; el E2E se define en un spec aparte. |

## What is **not** in this spec

- Docker, Compose, CI/CD y despliegue.
- Librerías compartidas y configuración de UI.
- Variables de entorno, base de datos y cualquier feature de producto.

Cada uno, si llega, tendrá su propio spec.