# SPEC 19 — Recuperación de contraseña (password reset)

> **Status:** Implemented
> **Depends on:** SPEC 04 (auth/users), SPEC 14 (i18n UI)
> **Date:** 2026-08-28
> **Objective:** Permitir que un usuario recupere su contraseña olvidada mediante un link enviado por email con token de un solo uso y expiración: el usuario pide el reset (`POST /auth/forgot-password`), recibe un email con un link a una página del frontend, y desde ese link define una nueva contraseña (`POST /auth/reset-password`), todo con soporte es/en y sin email real en desarrollo (se loguea el link en consola).

## Scope

**In:**

- **Modelo de datos**: agregar al modelo `User` las columnas `resetTokenHash` (`String?`) y `resetTokenExpiry` (`DateTime?`), con migración. El token se guarda **haseado** (bcrypt o hash), nunca en claro.
- **Envío de email (Nodemailer + SMTP)**: agregar `nodemailer` como dependencia del backend y un `MailService` configurado por env (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `APP_URL`). En desarrollo (sin SMTP real o con `MAIL_DRIVER=log`) el email no se envía: el link de reset se loguea en consola (stub). El link apunta a `APP_URL/auth/reset-password?token=...`.
- **Endpoint `POST /auth/forgot-password`** (`@Public()`): recibe `{ email }`. Genera un token de reset (random de alta entropía, p. ej. `crypto.randomBytes(32)`), guarda su hash y expiry (p. ej. 1h) en el `User`, y dispara el email con el link. **Siempre responde 200/201 sin distinguir si el email existe** (anti-enumeración); si no existe el usuario, no envía nada pero responde igual.
- **Endpoint `POST /auth/reset-password`** (`@Public()`): recibe `{ token, password }`. Valida el token (hash coincide, no expirado, un solo uso), actualiza `passwordHash` con bcrypt y **borra** `resetTokenHash`/`resetTokenExpiry` (token de un solo uso). Token inválido/expirado/ya usado → 400/401 genérico.
- **Frontend — páginas**: 
  - `/auth/forgot-password`: formulario de email, envía `POST /auth/forgot-password` y muestra confirmación ("si existe una cuenta, te enviamos un link").
  - `/auth/reset-password`: lee el `token` del query param de la URL, formulario para nueva contraseña (con confirmación y validación de fuerza), envía `POST /auth/reset-password` y, al éxito, redirige a `/auth/login`.
  - Rutas públicas (fuera del `authGuard`) en `app.routes.ts`.
- **i18n es/en**: textos de ambas páginas y mensajes de error/éxito.
- **Tests**: unitarios del `AuthService` (generación/validación del token, expiración, un solo uso, anti-enumeración) y del `MailService` (stub en dev); e2e del flujo completo (forgot → token en log → reset → login con la nueva contraseña → el token ya no sirve).

**Out of scope (para specs futuros):**

- Verificación de email al registrarse (email confirmation).
- Refresh tokens / sesiones multi-dispositivo.
- Rate limiting / captcha en los endpoints de recuperación (se mitiga a nivel de diseño con anti-enumeración).
- Cambio de contraseña estando logueado (change password) — es un flujo distinto.
- Expiración de links por una sola reutilización con múltiples tokens por usuario.
- Segunda vía de autenticación (2FA).

## Data model

Cambios en `backend/prisma/schema.prisma` (modelo `User`, migración `password_reset`):

```prisma
model User {
  // ...columnas existentes...
  passwordHash     String
  resetTokenHash   String?
  resetTokenExpiry DateTime?
  // ...
}
```

- `resetTokenHash`: hash del token aleatorio (bcrypt o hash SHA-256 con salt). Nunca el token en claro.
- `resetTokenExpiry`: `DateTime` de expiración (p. ej. now + 1h). Null si no hay reset pendiente.
- Al crear un nuevo reset se sobreescribe el hash y expiry anteriores (un solo token activo por usuario, el más reciente).

## Implementation plan

Cada paso deja el sistema compilable y funcionando.

1. **Deps y env backend**: agregar `nodemailer` (dependency) y `@types/nodemailer` (dev). En `backend/.env` y `.env.example`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `APP_URL` (default `http://localhost:4200`) y `MAIL_DRIVER` (`log` en dev, `smtp` en prod). Ampliar el `validationSchema` de `app.module.ts` (Joi) para las nuevas variables, con `MAIL_DRIVER` default `log` y `APP_URL` default `http://localhost:4200`.
2. **Schema y migración**: agregar `resetTokenHash` y `resetTokenExpiry` al modelo `User`. Ejecutar `prisma:migrate` (nombre `password_reset`) y `prisma:generate`.
3. **`MailService`**: crear `backend/src/mail/mail.service.ts` (y módulo) con `sendPasswordReset(email, resetUrl)`. Si `MAIL_DRIVER === 'log'` (o faltan credenciales SMTP), loguea el link en consola (`console.log`/`logger.warn`) y no envía; si `MAIL_DRIVER === 'smtp'`, usa Nodemailer con las credenciales. El `from` sale de `SMTP_FROM`. El asunto/cuerpo pueden ser es/en según se pase o un default.
4. **Service de reset en `AuthService`**: agregar:
   - `forgotPassword(email)`: busca el usuario por email; si no existe, retorna sin hacer nada (respuesta idéntica). Si existe: genera token con `crypto.randomBytes(32).toString('hex')`, guarda `resetTokenHash` (hash del token) y `resetTokenExpiry` (now + 1h), arma `resetUrl = ${APP_URL}/auth/reset-password?token=${token}` y llama a `MailService.sendPasswordReset`. No lanza errores que filtren la existencia del email.
   - `resetPassword(token, newPassword)`: busca el usuario cuyo `resetTokenHash` coincide con el hash del token provisto (bcrypt compare) y con `resetTokenExpiry > now`. Si no coincide o está expirado → `BadRequestException`/`UnauthorizedException` genérico. Si ok: `passwordHash = bcrypt.hash(newPassword)`, limpia `resetTokenHash`/`resetTokenExpiry` (transacción). Un solo uso porque el hash se borra tras usarlo.
5. **Controller**: agregar `POST /auth/forgot-password` y `POST /auth/reset-password`, ambos `@Public()`, con DTOs (`ForgotPasswordDto` = `{ email }`, `ResetPasswordDto` = `{ token, password }` con validación de contraseña ≥8). Registrar `MailModule` en `AuthModule` (o importar el provider).
6. **Tests backend**: unitarios de `AuthService.forgotPassword` (genera hash, no filtra si no existe el email) y `resetPassword` (hash, expiración, un solo uso, contraseña actualizada); unitarios de `MailService` (modo log). e2e `auth.e2e-spec.ts`: `forgot` con email existente → el link aparece en logs; `reset` con el token → login con la nueva contraseña ok; reutilizar el mismo token → error; `forgot` con email inexistente → misma respuesta 201.
7. **Frontend — página forgot**: crear `auth/forgot-password.component` (email + submit, SCSS del scaffold), servicio `AuthService.forgotPassword(email)`. Tras éxito muestra el mensaje genérico de confirmación. Ruta pública `/auth/forgot-password` y link "¿Olvidaste tu contraseña?" en la página de login.
8. **Frontend — página reset**: crear `auth/reset-password.component` que lee el `token` del `ActivatedRoute` (query param), formulario de nueva contraseña + confirmación (validación de coincidencia y fuerza), `AuthService.resetPassword(token, password)`. Al éxito redirige a `/auth/login` con mensaje. Ruta pública `/auth/reset-password`.
9. **i18n es/en**: agregar textos de ambas páginas y mensajes (éxito/error/validación) en ambos idiomas.
10. **Verificación final**: `npm run build:all`, `npm run lint:all`, `npm run test:all`, y flujo manual (pedir reset → link en consola → abrir página → nueva contraseña → login → intentar reutilizar el token → error; pedir reset con email inexistente → mismo mensaje de confirmación).

## Acceptance criteria

- [ ] `User` tiene `resetTokenHash` y `resetTokenExpiry`; migración `password_reset` aplicada y client regenerado. El token nunca se guarda en claro (solo su hash).
- [ ] `POST /auth/forgot-password` con email existente → 201 y email/link generado (en dev, link en consola); con email inexistente → **misma respuesta 201** (anti-enumeración, sin distinguir).
- [ ] El link de reset es `APP_URL/auth/reset-password?token=<token>` con token de alta entropía y expiry de 1h.
- [ ] `POST /auth/reset-password` con token válido y no expirado → actualiza `passwordHash` (bcrypt), limpia el token (un solo uso) y permite login con la nueva contraseña.
- [ ] Token inválido, expirado o ya usado → error 400/401 genérico, sin revelar detalles; no permite login con la contraseña anterior modificada de forma parcial.
- [ ] `MAIL_DRIVER=log` (dev) no envía email real, loguea el link; `MAIL_DRIVER=smtp` usa Nodemailer con SMTP.
- [ ] Frontend: `/auth/forgot-password` (pedir reset + confirmación genérica) y `/auth/reset-password` (leer token de la URL, nueva contraseña, redirige a login) funcionan, son rutas públicas y tienen textos i18n es/en.
- [ ] Hay un link "¿Olvidaste tu contraseña?" en la página de login.
- [ ] `npm run build:all`, `npm run lint:all` y `npm run test:all` pasan (frontend y backend).

## Decisions

- **Sí:** **link por email con token de un solo uso y expiración (1h)** como mecanismo de recuperación. Estándar, seguro y sin fricción extra para el usuario (a diferencia de códigos manuales).
- **Sí:** **token aleatorio de alta entropía guardado como hash** (`resetTokenHash`, bcrypt) con `resetTokenExpiry`. Si la DB se filtra, el token en claro no se recupera del hash.
- **Sí:** **Nodemailer con SMTP** para el envío, con **`MAIL_DRIVER=log` por defecto en dev**: sin infraestructura de email no se bloquea el flujo; el link se loguea en consola y el SMTP real se activa por env.
- **Sí:** **anti-enumeración** en `forgot-password`: respuesta idéntica exista o no el email. Se evita que un atacante descubra qué emails están registrados.
- **Sí:** **token de un solo uso** (se borra el hash tras usarlo) y **expiración**. Ambos evitan reutilización y links viejos.
- **Sí:** páginas frontend completas (`/auth/forgot-password`, `/auth/reset-password`) con i18n es/en.
- **No:** verificación de email al registrarse, rate limiting/captcha dedicado (mitigado por anti-enumeración), cambio de contraseña logueado, 2FA, múltiples tokens activos por usuario.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| El email real no está configurado en dev | `MAIL_DRIVER=log` por defecto: el link se loguea y el flujo es testeable sin SMTP. |
| Enumeración de emails válidos vía `forgot-password` | Respuesta idéntica (201) exista o no el email; no se filtra. |
| Token en claro comprometido si la DB se filtra | Se guarda solo el hash (`resetTokenHash`); el token en claro nunca se persiste. |
| Reutilización de un link o link vencido | Token de un solo uso (se borra al usarlo) + `resetTokenExpiry` de 1h; ambos validados al reset. |
| Nodemailer falla en prod y rompe el reset | `try/catch` en `MailService` para que el endpoint no falle si el envío falla; se loguea el error; el token sigue válido por si se reintenta. |
| Migración Prisma con la DB de dev caída | Verificar `up:db` activo antes de `migrate`. |

## What is **not** in this spec

- Verificación de email al registrarse.
- Refresh tokens / sesiones multi-dispositivo.
- Rate limiting / captcha dedicado.
- Cambio de contraseña estando logueado.
- 2FA.
- Múltiples tokens de reset activos por usuario.

Cada uno, si llega, tendrá su propio spec.
