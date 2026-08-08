# SPEC 05 — Perfil del candidato (Candidate Profile)

> **Status:** Implemented
> **Depends on:** SPEC 04
> **Date:** 2026-08-07
> **Objective:** Implementar el Candidate Profile del usuario autenticado —información personal, resumen, experiencia, habilidades, educación, certificaciones, proyectos y lenguajes— con persistencia relacional en Prisma, API REST de agregado (`GET`/`PUT /profile`) y pantalla de edición en el frontend Angular.

## Scope

**In:**

- Backend: 7 modelos nuevos en Prisma (`Profile`, `Experience`, `Skill`, `Education`, `Certification`, `Project`, `Language`) con relación 1:1 `User` ↔ `Profile`, migración y client generado.
- Creación automática del `Profile` al registrarse (mismo transaction del `register` de SPEC 04) y creación perezosa defensiva en `GET /profile` para usuarios ya existentes sin perfil.
- API REST protegido por el guard global (cookie, SPEC 04):
  - `GET /profile` → devuelve el agregado completo del usuario autenticado.
  - `PUT /profile` → recibe el agregado completo y lo reemplaza de forma idempotente (upsert de items con `id`, creación de items sin `id`, borrado de items ausentes), en transaction.
- DTOs con `class-validator`/`class-transformer` (mismo patrón de SPEC 04): validación de URLs, rangos de niveles (skills 1–5, lenguajes A1–C2), fechas ISO opcionales, `current` para experiencia/educación.
- Frontend: `ProfileService` (get/put), página `/profile` protegida con editores por sección (SCSS del scaffold, sin librerías de UI), enlace desde el dashboard.
- Tests: unitario `profile.service.spec.ts` y e2e `profile.e2e-spec.ts`.

**Out of scope (para specs futuros):**

- Importación de CV y extracción automática de información (feature MVP propia).
- Campo `source` (USER/CV_IMPORT/AI) para distinguir origen del dato: se agrega en el spec de importación de CV.
- Generación de CV, cover letters y cualquier documento derivado.
- Análisis de CV, job analysis, matching, skill gaps.
- Perfil bilingüe (contenido en dos idiomas): el perfil guarda un solo idioma; la traducción ocurre al generar documentos.

## Data model

Nuevos modelos en `backend/prisma/schema.prisma`. Se agrega la relación al `User` existente:

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  profile      Profile?
}

model Profile {
  id              String           @id @default(cuid())
  userId          String           @unique
  user            User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  headline        String?
  phone           String?
  location        String?
  website         String?
  linkedin        String?
  summary         String?
  experiences     Experience[]
  skills          Skill[]
  education       Education[]
  certifications  Certification[]
  projects        Project[]
  languages       Language[]
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
}

model Experience {
  id          String    @id @default(cuid())
  profileId   String
  profile     Profile   @relation(fields: [profileId], references: [id], onDelete: Cascade)
  company     String
  position    String
  location    String?
  startDate   DateTime?
  endDate     DateTime?
  current     Boolean   @default(false)
  description String?
  sortOrder   Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Skill {
  id        String   @id @default(cuid())
  profileId String
  profile   Profile  @relation(fields: [profileId], references: [id], onDelete: Cascade)
  name      String
  level     Int
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Education {
  id          String    @id @default(cuid())
  profileId   String
  profile     Profile   @relation(fields: [profileId], references: [id], onDelete: Cascade)
  degree      String
  institution String
  field       String?
  startDate   DateTime?
  endDate     DateTime?
  current     Boolean   @default(false)
  description String?
  sortOrder   Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Certification {
  id        String   @id @default(cuid())
  profileId String
  profile   Profile  @relation(fields: [profileId], references: [id], onDelete: Cascade)
  name      String
  issuer    String?
  year      Int?
  url       String?
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Project {
  id          String   @id @default(cuid())
  profileId   String
  profile     Profile  @relation(fields: [profileId], references: [id], onDelete: Cascade)
  name        String
  role        String?
  description String?
  url         String?
  techStack   String[]
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Language {
  id        String   @id @default(cuid())
  profileId String
  profile   Profile  @relation(fields: [profileId], references: [id], onDelete: Cascade)
  name      String
  level     String
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Convenciones:

- El perfil se guarda en **un solo idioma** (el que el usuario escribe). No hay campos bilingües.
- Fechas de experiencia/educación: `DateTime` con precisión de mes (día = 1). Si `current` es `true`, `endDate` se ignora/queda nulo.
- `skill.level`: entero 1–5 (1 básico, 5 experto).
- `language.level`: string CEFR, uno de `A1`, `A2`, `B1`, `B2`, `C1`, `C2`.
- `sortOrder`: orden de renderizado ascendente; lo controla el cliente.
- El email no vive en el `Profile`: proviene del `User`.
- No hay campo `source` en este spec (se difiere a la importación de CV).

## Implementation plan

Cada paso deja el sistema compilable y funcionando.

1. En `backend/prisma/schema.prisma`: agregar los 7 modelos y la relación `profile` en `User`. Ejecutar `prisma migrate dev` (nombre `candidate_profile`) y `prisma generate`.
2. En `backend/src/auth/auth.service.ts`: en `register`, crear el `User` y su `Profile` vacío en el mismo `$transaction` (el `register` actual de SPEC 04 debe volverse transaccional).
3. Crear `backend/src/profile/dto/profile.dto.ts`: `ProfileDto` con campos escalares opcionales y arrays de DTOs anidados (`ExperienceDto`, `SkillDto`, `EducationDto`, `CertificationDto`, `ProjectDto`, `LanguageDto`). Validaciones: strings con `@IsOptional`/`@MaxLength`, URLs con `@IsUrl` opcional, `skill.level` `@IsInt @Min(1) @Max(5)`, `language.level` `@IsIn(['A1','A2','B1','B2','C1','C2'])`, fechas `@IsISO8601` opcionales, `current` boolean, `techStack` array de strings, `id` opcional (string).
4. Crear `backend/src/profile/profile.service.ts`:
   - `getForUser(userId)`: busca el `Profile` con sus 6 colecciones ordenadas por `sortOrder`; si no existe, lo crea (fallback defensivo para usuarios registrados antes de este spec).
   - `replaceForUser(userId, dto)`: en un `$transaction`, actualiza los escalares del `Profile` y sincroniza cada colección — upsert por `id` (si el `id` pertenece a ese profile), creación cuando no hay `id`, borrado de items existentes cuyo `id` no viene en el payload. Devuelve el agregado actualizado.
   - No expone campos ajenos: las respuestas serializan el `Profile` del usuario autenticado únicamente.
5. Crear `backend/src/profile/profile.controller.ts`: `GET /profile` y `PUT /profile`, ambos protegidos por el guard global; el `userId` se lee del request (patrón `request-with-user.ts` de SPEC 04). Crear `backend/src/profile/profile.module.ts` y registrarlo en `app.module.ts`.
6. Tests: `backend/src/profile/profile.service.spec.ts` (get crea si falta, replace inserta/actualiza/borra, valida pertenencia de ids) y `backend/test/profile.e2e-spec.ts` (sin cookie → 401; GET → perfil vacío; PUT con datos → 200 y GET refleja; PUT sin `id` reemplaza colecciones).
7. Frontend: `frontend/src/app/profile/profile.service.ts` (`getProfile`/`putProfile` con `withCredentials`). Página `profile.component` standalone (SCSS del scaffold) con editores por sección: información personal, resumen, experiencia, habilidades, educación, certificaciones, proyectos, lenguajes; formularios de Angular con `FormArray`, alta/edición/borrado por item, y botón de guardado que hace un `PUT` del agregado completo. Ruta `/profile` protegida en `app.routes.ts` (reusa el guard de SPEC 04); enlace en `dashboard.component`.
8. Verificación final: `npm run build:all`, `npm run lint:all`, `npm run test -w career-analyzer-backend`, y flujo manual en navegador (login → `/profile` → completar secciones → guardar → recargar y verificar persistencia → logout).

## Acceptance criteria

- [ ] Los 7 modelos existen en `schema.prisma`, la migración `candidate_profile` está aplicada y el client regenerado.
- [ ] Registro de usuario → 201 y `Profile` vacío creado en la DB (verificable por `GET /profile` tras login).
- [ ] `GET /profile` sin cookie → 401; con cookie → 200 con el agregado del usuario (nunca el de otro usuario).
- [ ] `PUT /profile` crea items nuevos, actualiza los que traen `id` y borra los ausentes del payload; repetir el mismo `PUT` no duplica datos (idempotente).
- [ ] DTO inválido (nivel de skill 6, idioma `D3`, URL malformada, fechas no ISO) → 400.
- [ ] `current: true` en experiencia/educación persiste y no requiere `endDate`.
- [ ] `skill.level` y `language.level` se persisten tal cual (1–5 y A1–C2).
- [ ] El orden de renderizado respeta `sortOrder` ascendente en todas las colecciones.
- [ ] `npm run build:all` y `npm run lint:all` OK; `npm run test -w career-analyzer-backend` pasa (unit + e2e).
- [ ] `/profile` en el frontend carga el perfil, edita las 8 secciones, guarda con un `PUT` del agregado y persiste tras recargar; sin sesión redirige a `/auth/login`.
- [ ] No se usa `localStorage` para datos del perfil; todo viaja por la API.

## Decisions

- **Sí:** un solo spec con el perfil completo (8 secciones). Es un único dominio; partirlo creaba acoplamiento artificial entre base y secciones.
- **Sí:** tablas relacionales separadas (7 modelos) en lugar de un `Profile` con JSON. Tipado fuerte, queries por sección y coherencia con "source of truth" y Prisma.
- **Sí:** `Profile` 1:1 con `User`, auto-creado en el `register` (mismo transaction). Elimina null-checks; el fallback perezoso en `GET /profile` cubre usuarios previos al spec.
- **Sí:** un solo idioma por perfil (el del usuario). La traducción natural es responsabilidad de la generación de documentos, no del dato.
- **Sí:** API de agregado (`GET`/`PUT /profile`) con reemplazo idempotente, en lugar de CRUD por sección. Menos endpoints y un solo contrato "source of truth"; el frontend edita local y guarda todo.
- **Sí:** niveles de skill 1–5 y de idiomas CEFR A1–C2. Estandarizado y reconocible por reclutadores/ATS.
- **Sí:** `sortOrder` explícito por item para orden de presentación.
- **No:** campo `source` (USER/CV_IMPORT/AI) en este spec. Todo es manual aquí; el origen del dato llega con la importación de CV, cuando haga falta distinguir.
- **No:** perfil bilingüe, documentos derivados, análisis/matching, importación de CV — cada uno a su spec.
- **No:** librerías de UI nuevas en el frontend; SCSS del scaffold (patrón SPEC 04).

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Usuarios creados antes de este spec sin `Profile` | `GET /profile` crea el perfil perezosamente si falta; el `register` nuevo lo crea en el mismo transaction. |
| `PUT` con `id` de otra persona o de otra colección | El service valida que el `id` pertenezca al profile/colección del usuario antes de upsertear; caso contrario crea o ignora, nunca modifica datos ajenos. |
| Payload grande al guardar todo el agregado | Es un perfil personal (KBs); límites `@MaxLength` en campos largos; sin impacto real en el MVP. |
| Borrado accidental de items por un `PUT` incompleto | El frontend siempre envía el agregado completo; la semántica de reemplazo es explícita y documentada en el service. |
| Fechas con día inconsistente | Convención: día = 1, precisión de mes; validación `@IsISO8601`. |

## What is **not** in this spec

- Importación de CV y extracción automática de información (feature MVP propia).
- Campo `source` para distinguir dato de usuario vs AI/CV.
- Generación de CV, cover letters y otros documentos.
- Análisis de CV, job analysis, matching y skill gaps.
- Perfil bilingüe (contenido en dos idiomas simultáneos).

Cada uno, si llega, tendrá su propio spec.
