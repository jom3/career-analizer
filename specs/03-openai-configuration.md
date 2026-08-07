# SPEC 03 — Configuración de OpenAI en el backend

> **Status:** Implemented
> **Depends on:** SPEC 02
> **Date:** 2026-08-07
> **Objective:** Configurar en el backend NestJS el acceso a la API de OpenAI mediante el SDK oficial `openai` (v4+), expuesto como un módulo global con un client inyectable, y gestionar su key con `@nestjs/config` y validación `Joi` al boot.

## Scope

**In:**

- Dependencias nuevas en `backend`:`openai@^7` (en `dependencies`), `joi@^18` y `@types/joi@^17` (en `devDependencies`).
- Variable de entorno `OPENAI_API_KEY` en `backend/.env` y placeholder en `backend/.env.example`.
- `validationSchema` de `Joi` en el `ConfigModule` de `app.module.ts` (ya global desde SPEC 02) que valide `OPENAI_API_KEY` como string requerida, con `allowUnknown: true` para no romper el resto de variables.
- `backend/src/openai/openai.module.ts` (`@Global()`) y `backend/src/openai/openai.service.ts` que envuelve el SDK `OpenAI` y expone el client tipado.
- Alta de `OpenaiModule` en los imports de `app.module.ts`.
- Test unitario del `OpenaiService`/módulo.
- Verificación con `build:all` y `lint:all` y `test` del workspace backend.

**Out of scope (para specs futuros):**

- Cualquier feature que use el client de IA (CV analysis, job analysis, matching, cover letters). Este spec solo configura e inyecta el client.
- Abstracción multi-proveedor (interfaces `AiProvider`) para Anthropic/otros.
- Variables de config además de la key (`OPENAI_MODEL`, `OPENAI_BASE_URL`, `OPENAI_ORGANIZATION`).
- Llamadas reales a la API de OpenAI durante la verificación.
- Cualquier cambio en frontend.

## Data model

Este spec no introduce estructuras de negocio ni tablas. Introduce una variable de entorno (`OPENAI_API_KEY`) y un servicio/`module` que modifica la inyección de dependencias. Las estructuras de dominio relacionadas con IA pertenecen a specs de features.

## Implementation plan

Cada paso deja el sistema funcional y compilable.

1. En `backend/`: instalar `openai` y registrarlo en dependencies; instalar `joi` y `@types/joi` en devDependencies. Los locks actualizados en el lockfile del workspace.
2. Agregar `OPENAI_API_KEY=` (placeholder) a `backend/.env` y a `backend/.env.example`. El `.env` queda ignorado; `.env.example` se trackea.
3. En `backend/src/app.module.ts`: añadir al `ConfigModule.forRoot({ isGlobal: true })` la opción `validationSchema` construida con `Joi.object({ OPENAI_API_KEY: Joi.string().required() })` (y `validationOptions` por defecto de `@nestjs/config`).
4. Crear `backend/src/openai/openai.service.ts`: clase `@Injectable()` que en constructor recibe `ConfigService`, lee `OPENAI_API_KEY` (existe por la validación en boot), instancia `new OpenAI({ apiKey })` (SDK oficial) y lo expone vía getter `client`. Si por cualquier causa la key no está, es responsabilidad de la validación Joi bloquear el boot antes de que el módulo se instancie.
5. Crear `backend/src/openai/openai.module.ts` (`@Global()`, providers `[OpenaiService]`, exports `[OpenaiService]`). Agregar `OpenaiModule` a los imports de `app.module.ts`.
6. Escribir el test unitario `backend/src/openai/openai.service.spec.ts`: usa `Test.createTestingModule` con `ConfigModule` y `OpenaiModule`; con `OPENAI_API_KEY` set en el proceso (o mock de `ConfigService`), verifica que `OpenaiService` se resuelve, que expone `client`, y que `client` es instancia del SDK oficial.
7. Ejecutar `npm run build:all` (root), `npm run lint:all` y `npm run test -w career-analyzer-backend` para verificar.

## Acceptance criteria

- [ ] `openai` está en `dependencies` y `joi`/`@types/joi` en `devDependencies` de `backend`.
- [ ] `backend/.env` incluye `OPENAI_API_KEY` y `backend/.env.example` lo refleja como placeholder, sin secretos reales; `.env` sigue ignorado.
- [ ] `app.module.ts` configura `ConfigModule` con `validationSchema` de `Joi` que exige `OPENAI_API_KEY` (boot falla si falta).
- [ ] `OpenaiModule` y `OpenaiService` existen bajo `backend/src/openai/`; el módulo es `@Global()` y expone `OpenaiService`.
- [ ] `OpenaiService` construye el client oficial `OpenAI` con la key leída desde el entorno y lo expone vía `client`.
- [ ] `npm run build:all` (root) termina sin errores.
- [ ] `npm run lint:all` termina con 0 errores en el workspace backend.
- [ ] `npm run test -w career-analyzer-backend` pasa (incluye el test de `OpenaiService`).

## Decisions

- **Sí:** SDK oficial `openai` (v4+), envuelto en un `OpenaiService` NestJS, en lugar de HTTP propio: tipos y mantenimiento ofrecidos por OpenAI.
- **Sí:** solo `OPENAI_API_KEY`, siguiendo la simplicidad de SPEC 02 y de `AGENTS.md` (sin sobre-ingeniería). Modelo/base URL se deciden en el primer spec de feature.
- **Sí:** validación con `Joi` en el boot con fail-fast: evita arrancar la app con una key ausente o mal escrita.
- **Sí:** `OpenaiModule` global desde ya, para que cualquier feature de IA inyecte `OpenaiService` sin declarar el import.
- **No:** endpoints de IA, abstracción `AiProvider` multi-proveedor, llamadas reales de verificación ni config adicional — fuera del alcance de este spec.

## What is **not** in this spec

- Ninguna feature que consuma IA (análisis de CV, matching, generación de textos).
- Abstracción multi-proveedor y configuración de modelos/org/base URL.
- Frontend/Angular.

## Risks

| Riesgo                                                                     | Mitigación                                                                                                                 |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Arrancar sin `OPENAI_API_KEY` en `.env` o en el entorno | La validación `Joi` aborta el boot con un error claro; `.env.example` documenta la variable como obligatoria. |
| El `OpenaiService` expone un client sin usar (código muerto hasta el primer feature) | Es intencional: habilita la inyección; su uso real llega con los specs de feature. El costo es mínimo. |
| Versión del SDK `openai` que cambia la firma del constructor | Se fija la dependencia y se compromete el `package-lock.json` al implementar; el test del service valida que el client se construye. |