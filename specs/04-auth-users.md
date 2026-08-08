# SPEC 04 — Autenticación y usuarios (registro + login + protección de API)

> **Status:** Implemented
> **Depends on:** SPEC 02, SPEC 03
> **Date:** 2026-08-07
> **Objective:** Implementar el registro y login de usuarios en el backend NestJS con JWT (Bearer, 24h) entregado en cookie HttpOnly y hash de contraseñas con bcrypt nativo, proteger todos los endpoints con un guard global (whitelist `@Public()`), y proveer pantallas funcionales de login, registro y sesión en el frontend Angular con el scaffold SCSS actual.

## Scope

**In:**

- Backend: modelo `User` en Prisma (con migración), módulo `AuthModule` con endpoints `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` y `GET /auth/me` (protegido).
- Autenticación por **JWT en cookie HttpOnly** (`access_token`, 24h, `sameSite: lax`): el guard global lee el token de la cookie, no del header.
- Guard global `JwtAuthGuard` (protege todo por defecto) + decorator `@Public()` para `/health`.
- Hash de contraseñas con **bcrypt nativo** (`bcrypt`, binario precompilado).
- Variables `JWT_SECRET` y `CLIENT_ORIGIN` gestionadas con `@nestjs/config` y validadas con Joi al boot (patrón de SPEC 03).
- `ValidationPipe` global + `class-validator`/`class-transformer` en los DTOs.
- `cookie-parser` en `main.ts` y `enableCors` con origen `CLIENT_ORIGIN` y `credentials: true` (CORS directo, sin proxy de dev).
- Frontend: `AuthService` (sesión por cookie, estado con signal), guard de rutas Angular que valida contra `/auth/me`, páginas `/auth/login`, `/auth/register` y `/dashboard` (protegida: muestra `me` y logout), estiladas con SCSS del scaffold, sin librerías de UI.
- Tests: unitario `auth.service.spec.ts` y e2e `auth.e2e-spec.ts` (register → login → me → logout → 401 → 409).

**Out of scope (para specs futuros):**

- Refresh tokens, verificación de email, password reset, roles (admin/…), CSRF token dedicado.
- Relación `User` ↔ `Candidate Profile` (la crea el spec de perfil).
- Rate limiting, captcha, social login.
- Cualquier feature de producto (CV, análisis, matching).

## Data model

Nuevo modelo en `backend/prisma/schema.prisma`:

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

- `email` único actúa como username para login.
- `passwordHash` nunca se devuelve: las respuestas seleccionan explícitamente `id`, `email`, `name`, `createdAt` (sin `passwordHash`).
- No hay relación con Candidate Profile en este spec (queda para el spec de perfil).

## Implementation plan

Cada paso deja el sistema compilable y funcionando.

1. Deps backend: `@nestjs/jwt`, `bcrypt`, `class-validator`, `class-transformer`, `cookie-parser` (dependencies); `@types/bcrypt`, `@types/cookie-parser` (dev). Agregar script `prisma:migrate` (`prisma migrate dev`) en `backend/package.json`. Verificar que `bcrypt` instala su binario precompilado sin errores.
2. En `backend/.env` y `backend/.env.example`: `JWT_SECRET` (string ≥32) y `CLIENT_ORIGIN` (default `http://localhost:4200`). Ampliar el `validationSchema` de `app.module.ts` (Joi): `JWT_SECRET: Joi.string().min(32).required()` y `CLIENT_ORIGIN: Joi.string().uri().default('http://localhost:4200')`.
3. Agregar el modelo `User` y ejecutar la migración (`prisma:migrate` + `prisma:generate`).
4. Crear `backend/src/auth/`:
   - `dto/register.dto.ts` (`name` string 2–80, `email` validado, `password` string 8–128) y `dto/login.dto.ts` (`email`, `password`).
   - `auth.service.ts`: `register` (hash bcrypt, duplicado de email → `ConflictException` 409), `login` (credenciales inválidas → `UnauthorizedException` 401), `signToken`, `validateUser`.
   - `auth.controller.ts`: `POST /auth/register`, `POST /auth/login` (setea cookie `access_token`: HttpOnly, `maxAge` 24h, `secure` en prod, `sameSite: lax`), `POST /auth/logout` (borra la cookie), `GET /auth/me` (protegido, devuelve el usuario del request sin `passwordHash`).
   - `auth.module.ts` con `JwtModule.registerAsync` (secret y expiración desde `ConfigService`; `expiresIn: '24h'`).
5. `jwt-auth.guard.ts`: guard global que lee el token de la cookie `access_token` (vía `cookie-parser`), lo verifica con `JwtService` y usa `Reflector` para respetar `@Public()`. Agregar decorator `public.decorator.ts`. Registrar `AuthModule` en `app.module.ts`, proveer el guard con `APP_GUARD` y marcar `HealthController` con `@Public()`.
6. `main.ts`: agregar `app.use(cookieParser())`, `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))` y `app.enableCors({ origin: CLIENT_ORIGIN, credentials: true })`.
7. Tests: unitario de `AuthService` (hash, duplicados, login ok/fallo, verificación de token) y e2e `auth.e2e-spec.ts`: `register` → `login` (cookie presente) → `me` con cookie → `me` sin cookie 401 → duplicado 409 → `logout` borra cookie.
8. Frontend: `core/api.ts` con `API_BASE_URL = 'http://localhost:3000'`; `core/auth.service.ts` (`login/register/logout/isAuthenticated`, requests `withCredentials`, estado con signal).
9. Frontend: guard de rutas que consulta `/auth/me` (confirma sesión) y redirige a `/auth/login`; `auth.interceptor` solo setea `withCredentials: true` (sin header `Authorization`); componente funcional; registrar `provideHttpClient(withFetch(), withInterceptors(...))` y `ProvideRouter` en `app.config.ts`.
10. Frontend: componentes standalone `login.component`, `register.component` (SCSS del scaffold), con validadores de Angular Forms y mensajes de error (400/401/409); `dashboard.component` muestra los datos de `/auth/me` y botón de logout. Rutas en `app.routes.ts`: `/auth/login`, `/auth/register`, `/dashboard` (protegida). Tras login/registro → redirección a `/dashboard`; logout → redirección a `/auth/login`.
11. Verificación final: `npm run build:all`, `npm run lint:all`, `npm run test -w career-analyzer-backend`, y flujo manual en navegador (registro → login → cookie presente y HttpOnly → dashboard → logout → cookie limpia → redirección a login).

## Acceptance criteria

Backend:

- [ ] `User` en `schema.prisma`, migración aplicada y client generado.
- [ ] `POST /auth/register` con payload válido → 201 (sin `passwordHash`); email duplicado → 409; DTO inválido → 400.
- [ ] En la DB solo existe el hash de **bcrypt** (`bcrypt`), nunca la contraseña en claro.
- [ ] `POST /auth/login` correcto → 200 y set de cookie `access_token` (HttpOnly, 24h, `sameSite: lax`); credenciales incorrectas → 401.
- [ ] `POST /auth/logout` limpia la cookie.
- [ ] `GET /auth/me` con cookie/token válido → usuario; sin cookie, token inválido o expirado → 401.
- [ ] El guard global lee el token de la **cookie**, no del header `Authorization`; `/health` sigue público (200 sin cookie) y el resto protegido.
- [ ] CORS activo para `CLIENT_ORIGIN` con `credentials: true`; `ValidationPipe` responde 400 en DTOs malformados.
- [ ] `npm run build:all` y `npm run lint:all` OK; `npm run test -w career-analyzer-backend` pasa (unit + e2e).

Frontend:

- [ ] `/auth/login` y `/auth/register` funcionales contra el API (SCSS del scaffold, sin librerías de UI nuevas).
- [ ] Tras login registro exitoso → redirección a `/dashboard`; logout limpia y redirige a `/auth/login`.
- [ ] Visitar `/dashboard` sin sesión → redirección a `/auth/login`.
- [ ] Requests con `withCredentials: true`; **no** se usa `localStorage` para el token.

## What is **not** in this spec

- Refresh tokens, verificación de email, recuperación de contraseña, roles/admin, rate limiting, captcha, CSRF token dedicado, social login.
- Vínculo `User` ↔ `Candidate Profile` (spec del perfil).
- Cualquier feature de producto (CV, análisis, matching).
- Interceptor de `Authorization` y almacenamiento de token en `localStorage`.

## Decisions

- **Sí:** acceso JWT (Bearer) de 24h sin refresh — suficiente para MVP y SPA; re-login al expirar. Trade-off documentado: renovación pendiente de evolución.
- **Sí:** cookie HttpOnly `access_token` en lugar de `localStorage` — elimina el robo de token vía XSS (JS no puede leer la cookie). El riesgo de CSRF se mitigue con `SameSite=lax` + CORS con origen explícito y `credentials: true` (el frontend `:4200` y la API `:3000` comparten `site`).
- **Sí:** guard global + `@Public()` — todo endpoint nuevo queda protegido por defecto.
- **Sí:** guard custom con `JwtService` en vez de Passport — misma seguridad con menos dependencias (simplicidad según `AGENTS.md`).
- **Sí:** `bcrypt` nativo (C, binario precompiled, estándar de facto y el más rápido) en lugar de `bcryptjs`, como pidió el usuario.
- **Sí:** `class-validator`/`ValidationPipe` global con `whitelist` y `transform`.
- **Sí:** CORS directo en Nest con origen en env y `credentials: true` — el mismo modelo que valdrá en producción (sin proxy de dev).
- **No:** relación con `Candidate Profile`, roles, verificación de email, refresh, rate limiting, CSRF token, interceptor `Authorization` — se difieren a specs propios.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| `bcrypt` nativo: binario precompulated para la plataforma puede faltar y la compilación fallar en Windows | Normalmente trae prebuilt para Windows; si falla, se necesita build tools una vez y el fallback es `bcryptjs` con la misma interfaz. |
| `JWT_SECRET` débil o ausente | Joi exige ≥32 caracteres y el boot falla antes del guard; `.env.example` documenta placeholder; `.env` queda gitignored. |
| CSRF cross-site con la cookie | `SameSite=lax` bloquea cookies en requests cross-site; CORS con origen explícito; el CSRF token se evalúa cuando haga falta. |
| CORS abierto accidentalmente | Solo `CLIENT_ORIGIN` desde env con `credentials: true`; nunca `origin: true`. |
| XSS residual en el frontend pese a HttpOnly | La cookie no es legible ni exfiltrable; mitigación real de XSS (sanitización y CSP) se administra en el spec de frontend/UI. |
| Migración Prisma con la DB de dev caída | Verificar `up:db` activo antes de `migrate`; base en los pasos 3 y 4. |

## What is **not** in this spec

- Refresh tokens, verificación de email, recuperación de contraseña, roles/admin, CSRF, captcha, social login.
- Relación `User` ↔ `Candidate Profile` y cualquier feature de producto.
- Config de rates, rate limiting y protección avanzada de despliegue (se decide en el spec de disponibilidad o despliegue).

Cada uno, si llega, tendrá su propio spec.