# SPEC 15 — Dockerizar la aplicación (Postgres + backend + frontend)

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-08-11
> **Objective:** Dockerizar toda la aplicación: Postgres, backend NestJS y frontend Angular con hot-reload en desarrollo y builds multi-stage con nginx en producción, unificados en un único `docker-compose.yml` en la raíz con proxy `/api`, persistencia de datos por volúmenes y configuración por `env_file`.

## Scope

**In:**

- **Compose único en la raíz** reemplaza `backend/docker-compose.yml` (eliminado). Tres archivos:
  - `docker-compose.yml` — entorno de **desarrollo**: `db` + `backend` (watch) + `frontend` (`ng serve`) con volúmenes bind y hot-reload; recreado desde el actual `backend/docker-compose.yml` para la DB.
  - `docker-compose.prod.yml` — override de **producción**: builds multi-stage, imagen backend sin montar código fuente, frontend servir por nginx, sin puerto público del backend.
  - `.dockerignore` en la raíz (contexto de build = raíz).
- **Backend `Dockerfile`** multi-stage (`node:22-alpine` en build y runtime):
  - Etapa build: `npm ci` en modo workspaces (raíz), `prisma generate` (con `DATABASE_URL` placeholder para no fallar sin CLI env), `nest build`.
  - Etapa runtime: usuario **no root** (`USER node`), copia `dist`, `prisma/` y `node_modules` completos (retiene la CLI de Prisma para `migrate deploy` en runtime), `WORKDIR /app/backend`, `CMD node dist/main.js`.
- **Frontend `Dockerfile`** multi-stage: etapa build `node:22-alpine` (`npm ci` + `ng build` production → `dist/browser/`); etapa runtime `nginx:alpine` copiando el build en `/usr/share/nginx/html` y `nginx.conf` como `default.conf`.
- **Proxy `/api` con strip en nginx y en el proxy de dev de Angular** (el backend NO cambia rutas, prefijos ni e2e):
  - `frontend/nginx.conf` (prod): `location /api/ { proxy_pass http://backend:3000/; }` — el `/api` se quita al reenviar (single-origin, sin CORS en prod, cookies limpias).
  - `frontend/proxy.conf.js` (dev): target `process.env.API_PROXY_TARGET ?? 'http://localhost:3000'` con `pathRewrite` de `/api` → vacío.
  - `frontend/src/app/core/api.ts`: `API_BASE_URL` pasa de `'http://localhost:3000'` a `'/api'` (single valor, válido en dev y prod).
  - `angular.json`: `serve.options.proxyConfig = "proxy.conf.js"`.
- **Persistencia**: volúmenes con nombre `pgdata` (DB, como hoy) y `uploads` (CVs subidos → camino relativo al cwd `/app/backend/uploads` en prod). Sobreviven a `docker compose down` sin `-v`.
- **Configuración**: todos los servicios leen el `.env` de la raíz vía `env_file: .env` (ya tiene `DATABASE_URL` apuntando a `db:5432` y `POSTGRES_*`); la DB usa `${POSTGRES_USER}`/`${POSTGRES_PASSWORD}`/`${POSTGRES_DB}` y los puertos `${BACKEND_PORT}`/`${FRONTEND_PORT}`/`${DB_PORT}` con defaults. Se crea `/.env.example` (mismos nombres, valores vacíos; **nunca se commitan secretos**, el `.env` real sigue en `.gitignore` y se excluye con `.dockerignore`).
- **Migraciones**: manuales y documentadas (decisión del usuario): `docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend npx prisma migrate deploy`. Los contenedores no migran solos.
- **Operación**: scripts en `package.json` raíz (`docker:up`, `docker:down`, `docker:build`, `docker:prod:up`, `docker:prod:down`). Se actualiza `backend/package.json` `up:db` → `docker compose -f ../docker-compose.yml up -d db`. Sección "Running with Docker" corta en el `README.md` raíz.

**Out of scope (para specs futuros):**

- CI/CD (GitHub Actions u otro) para construir y publicar imágenes.
- Deploy a cloud (Docker Hub, registry, Kubernetes, VPS específico, HTTPS/certificado).
- Instrumentación: logs centralizados, métricas, healthcheck externo con retry.
- Multi-stage de desarrollo separado a producción para el frontend dev (el compose dev usa `node:22-alpine` directo con el mismo Dockerfile etapa build).
- Cambios al código de backend más allá de lo infra (0 lógica de negocio).

## Data model

No hay cambios en backend ni en `schema.prisma`. **No** hay estructuras de datos nuevas. Los `docker-compose` no introducen DTOs ni modelos; sí definen estos **artefactos de infraestructura**:

```yaml
# docker-compose.yml (dev) — esqueleto conceptual
services:
  db: { image: postgres:18.4-alpine3.24, healthcheck: pg_isready, volumes: [pgdata] }
  backend: { build: front.../backend/Dockerfile target build, working_dir: /app, command: npm run start:backend, env_file: .env, volumes: [.:/app, backend_node_modules:/app/node_modules] }
  frontend: { build: front.../Dockerfile target build, working_dir: /app, command: ng serve --host 0.0.0.0 --poll 1000, env: API_PROXY_TARGET=http://backend:3000, volumes: [.:/app, frontend_node_modules:/app/node_modules] }
volumes: [pgdata, backend_node_modules, frontend_node_modules]
```

```yaml
# docker-compose.prod.yml (override)
services:
  backend:
    build: { context: ., dockerfile: backend/Dockerfile, target: runtime }
    volumes: [uploads:/app/backend/uploads]
  frontend:
    build: { context: ., dockerfile: frontend/Dockerfile }
    ports: ["${NGINX_PORT:-8080}:80"]
volumes: [uploads]
```

Convenciones:

- El servicio de la DB mantiene imagen `postgres:18.4-alpine3.24` y contenedor `career_analyzer_db` del compose actual.
- Contexto de build siempre la raíz del repo; uso de workspaces npm (`npm ci` en raíz).
- Imágenes en español se nombran idénticas a los servicios (`career-analyzer-backend` / `career-analyzer-frontend`).

## Implementation plan

Cada paso deja el sistema compilable y funcionando.

1. **Base del compose raíz + DB**: crear `/.dockerignore` (`**/node_modules`, `**/dist`, `**/.angular`, `coverage/`, `uploads/`, `.env`, `*.log`, `.git`, `specs/`). Eliminar `backend/docker-compose.yml`. Crear `docker-compose.yml` en la raíz con el servicio `db` (imagen postgres actual, healthcheck `pg_isready -U $${POSTGRES_USER}`, env `${POSTGRES_*}` del `.env` raíz, puerto `${DB_PORT:-5432}:5432`, volumen `pgdata`). Actualizar `backend/package.json`: `"up:db": "docker compose -f ../docker-compose.yml up -d db"`. Verificar: `npm run up:db -w career-analyzer-backend` levanta Postgres y `docker compose ps` lo muestra healthy.
2. **Dockerfile backend + servicio dev**: crear `backend/Dockerfile` multi-stage (`build` y `runtime`, `node:22-alpine`, `USER node` en runtime). Agregar al compose raíz el servicio `backend`: build desde `backend/Dockerfile` target `build`, `working_dir: /app`, `command: npm run start:backend`, `env_file: .env`, volúmenes `.:/app` + named `backend_node_modules:/app/node_modules`, `depends_on: db (condition: service_healthy)`, puerto `${BACKEND_PORT:-3000}:3000`. Verificar: `docker compose up backend` compila y `nest start --watch` escucha en 3000; `GET /health` desde el host responde `{"status":"ok"}`.
3. **Proxy dev + cambio de `API_BASE_URL`**: crear `frontend/proxy.conf.js` (target `process.env.API_PROXY_TARGET ?? 'http://localhost:3000'`, `pathRewrite` `/api`→``, `changeOrigin: true`). Cambiar `frontend/src/app/core/api.ts` a `export const API_BASE_URL = '/api';`. Agregar `proxyConfig` en `angular.json` (serve). Este paso afecta también al dev **local** sin Docker: el proxy de Angular mantiene el flujo, por eso proxy y cambio de URL van juntos. Verificar: `npm run start:frontend` local en 4200 sigue autenticando y consumiendo el backend seteado.
4. **Frontend dev en el compose**: agregar servicio `frontend`: build `frontend/Dockerfile` target `build`, `working_dir: /app`, `command: npm run start -w career-analyzer-frontend -- --host 0.0.0.0 --poll 1000`, `environment: API_PROXY_TARGET=http://backend:3000`, volúmenes `.:/app` + `frontend_node_modules:/app/node_modules`, puerto `${FRONTEND_PORT:-4200}:4200`, `depends_on: backend`. Verificar: `docker compose up frontend`; abrir `http://localhost:4200`, registrar usuario y recorrer el flujo completo (perfil, import CV, oferta) sin errores de red.
5. **Prod frontend (nginx)**: crear `frontend/nginx.conf` (listen 80, `root /usr/share/nginx/html`, `location /api/ { proxy_pass http://backend:3000/; }` con `Host`/`X-Forwarded-*`, `location / { try_files $uri $uri/ /index.html; }`). Terminar `frontend/Dockerfile` (etapa build `npm ci` + `ng build`; etapa `nginx:alpine` copiando `dist/browser/` y el `nginx.conf`). Verificar: `docker build -f frontend/Dockerfile .` genera la imagen con el SPA compilado.
6. **Compose prod**: crear `docker-compose.prod.yml`: override de `backend` (target `runtime`, sin puerto público al host, volumen `uploads:/app/backend/uploads`) y `frontend` (puerto `${NGINX_PORT:-8080}:80`, `depends_on: backend`). Verificar: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` deja la app en `http://localhost:8080` y `/api/health` responde `{"status":"ok"}`.
7. **Herramientas y documentación**: scripts `docker:*` en el `package.json` raíz. Crear `/.env.example` con el mismo set de variables que el `.env` raíz y valores vacíos (usuario crea su `.env` real a partir de él). Agregar la sección "Running with Docker" al `README.md` (comandos dev/prod, migraciones manuales, volúmenes). Verificar: `npm run docker:up`, `npm run docker:prod:up` y `docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend npx prisma migrate deploy` funcionan; `git status` no muestra `.env` ni archivos de uploads.
8. **Verificación final**: sobre DB fría, `prisma migrate deploy` aplica todas las migraciones existentes; flujo manual dev y prod completos (login, importación de CV, generación de documento); `npm run build:all`, `npm run lint:all` y `npm run test:all` en la raíz pasan.

## Acceptance criteria

- [ ] `npm run build:all`, `npm run lint:all` y `npm run test:all` en la raíz pasan **sin cambios de backend** (0 diffs de lógica; los e2e siguen apuntando a `/auth/register`, `/profile`, etc., porque el strip de `/api` es solo de nginx/proxy de dev).
- [ ] `backend/docker-compose.yml` ya no existe; existe `docker-compose.yml` en la raíz con los servicios `db`, `backend` y `frontend`; `backend/package.json` `up:db` usa el compose raíz y levanta solo la DB.
- [ ] Dev: `docker compose up -d --build` arranca los 3 servicios; `http://localhost:4200` carga el SPA, se autentica contra el backend en contenedor y el flujo completo (perfil → import CV → oferta → documento) funciona sin errores de red.
- [ ] `frontend/src/app/core/api.ts` usa `'/api'`; **no queda** ninguna referencia hardcodeada a `http://localhost:3000` en `frontend/src` (`rg`); `angular.json` tiene `proxyConfig`.
- [ ] `frontend/nginx.conf` hace strip en `location /api/` → `backend:3000`; en prod la app se sirve single-origin desde nginx y al hacer login las cookies viajan al mismo origen (sin CORS).
- [ ] Prod: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` → `http://localhost:8080` sirve el SPA; `http://localhost:8080/api/health` responde `{"status":"ok"}`; `/api/profile` etc. resuelven a las rutas reales del backend (sin prefijo).
- [ ] Los logs de build de prod muestran que la imagen del backend corre como `USER node` (no root) y la del frontend usa `nginx:alpine`.
- [ ] Persistencia: crear usuario e importar un CV → `docker compose down` (sin `-v`) → `docker compose up -d` → el usuario, los datos y los archivos de `uploads` siguen presentes; `docker compose down -v` los borra explícitamente.
- [ ] Sobre una base vacía, `docker compose ... exec backend npx prisma migrate deploy` aplica todas las migraciones existentes (log sin errores) y la app queda operativa.
- [ ] `/.env.example` existe con los mismos nombres de variables que el `.env` raíz y valores vacíos; `.env` (real, con secretos) sigue en `.gitignore` y **no** se copia a las imágenes (excluido por `.dockerignore`).
- [ ] No se toca `specs/.spec-config.yml`; los únicos archivos nuevos de config son compose/dockerfile/nginx/proxy/`.env.example`.

## Decisions

- **Sí:** **compose único en la raíz** (`docker-compose.yml` dev + `docker-compose.prod.yml` override). Concentra los 3 servicios, reutiliza el `.env` raíz que ya apunta `DATABASE_URL` a `db:5432`, y elimina `backend/docker-compose.yml` (que solo tenía la DB). `npm run up:db` se conserva apuntando al nuevo archivo.
- **Sí:** **proxy `/api` con strip en nginx y en el proxy de dev de Angular, sin `setGlobalPrefix` en NestJS.** El backend no toca rutas ni controladores; los e2e existentes ni siquiera necesitan revisión. El prefijo es solo de la capa de ruteo (nginx en prod, Angular dev-server en dev), manteniendo single-origin y cookies sin CORS.
- **Sí:** **`node:22-alpine` en build y runtime** (decisión del usuario; mitigación bcrypt/prisma en *Risks*) y **`nginx:alpine`** para prod frontend. **No** se usa `node:22-slim`.
- **Sí:** **migraciones manuales** (`prisma migrate deploy` documentado). El contenedor de runtime conserva la CLI de Prisma y `dotenv` (devDeps) para poder migrar sin tooling externo, a costa de mayor tamaño de imagen.
- **Sí:** **volúmenes con nombre `pgdata` + `uploads`.** Los CVs subidos se guardan en `backend/uploads` (cwd del contenedor); en prod se monta `uploads` para que sobrevivan al recreo del contenedor. Los named volumes de `node_modules` (`backend_node_modules`/`frontend_node_modules`) evitan que el bind de la raíz pise deps instaladas para linux.
- **Sí:** **config por `env_file: .env`** en todos los servicios; la DB consume `${POSTGRES_*}` y los puertos `${BACKEND_PORT}/${FRONTEND_PORT}/${DB_PORT}` con defaults. Se agrega `/.env.example` con valores vacíos; ningún secreto entra al repo ni a las imágenes (`.gitignore` + `.dockerignore`).
- **Sí:** **hot-reload en dev** con volúmenes bind de la raíz y `--poll` en `ng serve` (watch fiable en bind mounts de Windows).
- **No:** CI/CD, deploy a nube, HTTPS/tls, instrumentación, cambios de lógica de backend, `setGlobalPrefix('api')` en NestJS (evita tocar e2e; el strip vive en la capa de proxy).

## Risks

| Riesgo | Mitigación |
| --- | --- |
| `bcrypt` (binario nativo) o engine de Prisma fallan en `alpine` (musl) por falta de prebuild y en toolchain | En la etapa build se instala toolchain (`apk add python3 make g++`) solo si `npm ci` lo requiere; fallback documentado: cambiar base de `node:22-alpine` a `node:22-slim` en el Dockerfile y rebuild. |
| `prisma generate` en build falla sin `DATABASE_URL` (usa `process.env` vía `prisma.config.ts`) | Se setea un placeholder (`DATABASE_URL=postgresql://x:x@localhost:5432/x`) solo en la etapa build; en runtime el valor real llega por `env_file`. |
| El bind `.:/app` en Windows pisa dependencias instaladas para linux | Named volumes `backend_node_modules` y `frontend_node_modules` montados sobre `/app/node_modules`; `npm ci` corre dentro del build/entry del contenedor. |
| Watch de `ng serve` no detecta cambios en bind mounts de Windows | `--poll 1000` en el comando dev del compose; sin esto el dev en Docker sería inutilizable en Windows. |
| Magnitud de imagen prod por no-prune de devDeps (Prisma CLI en runtime) | Aceptada (migraciones manuales sin tooling externo); se puede mover a una etapa `runner` slim si el tamaño importa (decidir en spec de deploy). |
| Se filtra un secreto del `.env` real en una imagen o en el repo | `.dockerignore` excluye `.env` y `**/.env`; `.gitignore` ya lo excluye; criterio de aceptación verifica que no se COPIE `.env`; el `/.env.example` se crea a mano con valores vacíos. |
| El cambio de `API_BASE_URL` rompe specs de frontend que asertan la URL absoluta | Los specs existentes mockean `HttpClient` y no asertan el host (verificado al implementar con `ng test`); si alguno lo hiciera, se ajusta al criterio verde del paso 3. |

## What is **not** in this spec

- CI/CD (GitHub Actions u otro) para build/push de imágenes.
- Deploy a nube, registry, Kubernetes o HTTPS.
- Instrumentación (logs centralizados, métricas, alertas).
- Cambios a la lógica de backend o a los e2e existentes.
- `setGlobalPrefix('api')` en NestJS.
- Docker multi-env por branch o estadios intermedios.

Cada uno, si llega, tendrá su propio spec.