# SPEC 12 — CV adaptado a la oferta (tailoring)

> **Status:** Approved
> **Depends on:** SPEC 05, SPEC 07, SPEC 09, SPEC 10, SPEC 11
> **Date:** 2026-08-09
> **Objective:** Generar y persistir una versión del CV adaptada a una oferta concreta —tomando el Candidate Profile como única fuente de verdad y la oferta (más su match, si existe) como foco de adaptación—, donde las reglas del sistema seleccionan y ordenan, la IA solo reformula prosa integrando keywords de forma natural sin inventar datos, y el resultado queda auditable y exportable en PDF/DOCX reutilizando la plantilla de SPEC 07/09.

## Scope

**In:**

- Backend: modelo `AdaptedCv` en Prisma (versión persistida por usuario/oferta, historial append-only, auditabilidad con snapshots y huella del perfil), con migración.
- Entrada —**un solo endpoint** `POST /cv-adaptation`:
  - **`jobOfferId`** (obligatorio): id de una oferta guardada del usuario (SPEC 10). Se carga la `JobOffer`; si no existe o no es del usuario → 404. Aporta `requiredSkills`, `preferredSkills`, `keywords`, `sourceLanguage` y `experienceSummary`.
  - **`jobMatchId`** (opcional): id de un `JobMatch` (SPEC 11) del usuario. Aporta `gaps` para que la IA redacte sin afirmar tener skills `MISSING` (los `HAVE`/`PARTIAL` se resaltan si el perfil las declara). Si viene y no existe o no es del usuario → 404.
  - El **Candidate Profile siempre es la fuente**: el adaptado se deriva del perfil actual del usuario; jamás hay texto pegado ni borrador externo.
- Análisis con IA vía `OpenaiService` (SPEC 03) usando **structured outputs**. **División de responsabilidades** (regla de negocio):
  - **El sistema decide por reglas:** la lista de skills del adaptado = skills del perfil reordenados poniendo primero la intersección perfil ∩ (whitelist de la oferta: `requiredSkills` + `preferredSkills` + tokens de skills citados en `experienceSummary`), conservando el orden relativo; después el resto de skills del perfil. Experiencias y proyectos se reordenan por relevancia (los que citan un skill de la intersección primero); no se descartan items completos. **El `summary` también es del sistema**: se construye de forma determinista con datos reales del perfil (rol del headline o de la experiencia más reciente, antigüedad solo si hay fechas reales, skills matcheadas o top del perfil) más una **línea de compromiso honesta** con las tecnologías de la oferta (`missingSkills`) que el perfil no declara — "Compromiso con el aprendizaje de X" —, nunca como posesión. Estas decisiones son deterministas y server-side, no de la IA.
  - **La IA solo reformula prosa:** `experiences[].description`, en el idioma de la oferta, integrando keywords de forma natural y profesional (nunca keyword stuffing, nunca datos que no estén en el snapshot). El prompt aclara que "el resumen no es trabajo de la IA". **Permanece verbátim** (la IA no toca, y el servidor no deja alterar): compañías, posiciones, fechas, `metrics` (logros declarados, SPEC 09), nombres de skills, educación, certificaciones, idiomas, proyectos.
- Garantía **no inventar** (invariante README), verificable server-side:
  - `content.skills` se construye **solo** desde skills reales del perfil (sistema, no IA): `skills ⊆ skills(perfil)`.
  - Los items de experiencia/proyecto conservan `originalId` y sus campos estructurales se copian verbátim del snapshot; el servidor valida que empresa/posición/fechas/métricas del resultado sean idénticas a las del perfil.
  - La reescritura de prosa queda restringida por prompt y **auditable**: se persisten `profileSnapshot` y `offerSnapshot` para diff/revisión.
- El CV adaptado se distingue del dato del usuario: es un artefacto propio persistido, etiquetado **"Adaptado por IA"** en la UI; no modifica el perfil (nada escribe de vuelta a `/profile`).
- Persistencia: `AdaptedCv` por generación (historial append-only). Algoritmo:
  - `POST /cv-adaptation` → genera fresco y persiste.
  - `GET /cv-adaptation/:id` → sirve el guardado; compara la huella del perfil actual y devuelve `stale: boolean` (si el perfil cambió). **No hay recompute**: para actualizar, el usuario genera una versión nueva.
- Exportación: reutiliza `CvExportService` (SPEC 07/09). `buildPdf(data, lang)`/`buildDocx(data, lang)` ya reciben una estructura `CvData`; el `content` adaptado se mapea a esa misma forma y se renderiza con la plantilla estándar de una sola columna (skills sin nivel, idiomas `name (CEFR)`, métricas como bullets donde existen — SPEC 09). Los skills del adaptado se agrupan por categorías (SPEC 09): 3-4 párrafos `Categoría: skill1, skill2, ...`; con <4 skills un solo grupo sin llamar a la IA; ante fallo o respuesta inválida, fallback a un único grupo con las skills reales (nunca rompe la exportación).
- API REST protegido por el guard global (SPEC 04):
  - `POST /cv-adaptation` → body `{ jobOfferId, jobMatchId? }`; valida ownership de ambos; genera y persiste → 201.
  - `GET /cv-adaptation` → historial del usuario (desc por `createdAt`).
  - `GET /cv-adaptation/:id` → versión del usuario (404 si es de otro o no existe); incluye `stale`.
  - `GET /cv-adaptation/:id/export?format=pdf|docx&lang?` → `StreamableFile` con la plantilla de SPEC 07. `format` requerido (`@IsIn(['pdf','docx'])`); `lang` opcional para los títulos de sección, **default = `sourceLanguage` de la oferta si es `es`/`en`, si no `es`** (los títulos acompañan al contenido adaptado).
  - `DELETE /cv-adaptation/:id` → borra la versión (no borra la oferta ni el match).
- Frontend:
  - Página `/cv-adaptation` (SCSS del scaffold, sin librerías UI) con el historial; detalle `/cv-adaptation/:id` con el CV estructurado, etiqueta "Adaptado por IA", botones "Descargar PDF"/"Descargar DOCX", banner de `stale` y aviso "El perfil cambió desde esta versión: genera una nueva".
  - Botón **"Adaptar CV"** en el detalle de un `JobMatch` (SPEC 11) → `POST` con `{ jobOfferId, jobMatchId }` → navega al detalle.
  - Botón **"Adaptar CV"** por oferta en el historial de `/job-analysis` (SPEC 10) → `POST` con `{ jobOfferId }` → navega al detalle.
- Tests: unitarios del parser (OpenAI mockeado: prosa adaptada en el idioma de la oferta, contenido inválido → error), del service (persiste, whitelist de skills, campos estructurales verbátim, stale, ownership, `jobMatchId` ajeno → 404), de export con datos adaptados, y e2e del flujo completo.

**Out of scope (para specs futuros):**

- Cover letters / cartas de motivación (feature MVP propia).
- Aplicar el adaptado de vuelta al perfil (la IA nunca edita datos del usuario).
- Multiversión editable del adaptado (el usuario edita la versión antes/después de generar) — solo se genera sobre el perfil; el preview editable queda para el spec de cover/documents.
- Comparación entre versiones o diff visual.
- Recomendación de cursos/certificaciones para cerrar gaps (la IA solo evita afirmar skills `MISSING`).
- Múltiples templates (sigue la plantilla única de SPEC 07).

## Data model

Agregar el modelo `AdaptedCv` más las relaciones en `User`, `JobOffer` y `JobMatch`:

```prisma
model User {
  // ... campos de SPEC 04/05/10/11
  adaptedCvs AdaptedCv[]
}

model JobOffer {
  // ... campos de SPEC 10
  adaptedCvs AdaptedCv[]
}

model JobMatch {
  // ... campos de SPEC 11
  adaptedCvs AdaptedCv[]
}

model AdaptedCv {
  id                 String   @id @default(cuid())
  userId             String
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  jobOfferId         String?
  jobOffer           JobOffer? @relation(fields: [jobOfferId], references: [id], onDelete: SetNull)
  jobMatchId         String?
  jobMatch           JobMatch? @relation(fields: [jobMatchId], references: [id], onDelete: SetNull)
  sourceLanguage     String?
  content            Json     // estructura CvData adaptada (SPEC 07/09)
  offerSnapshot      Json     // JobOffer usada al adaptar
  profileSnapshot    Json     // vista agregada del perfil usada al adaptar
  profileFingerprint String   // huella del perfil al momento de adaptar
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

Convenciones:

- `jobOfferId` **nullable** con `onDelete: SetNull`: borrar la oferta (SPEC 10) no borra las versiones de CV (son deliverables del usuario).
- `jobMatchId` nullable y `onDelete: SetNull`: borrar un match no borra la versión; queda sin referencia de gaps.
- `content`: JSON con la forma `CvData` de SPEC 07/09:
  - `headline?`, `phone?`, `location?`, `website?`, `linkedin?`, `summary?`.
  - `experiences`: `[{ originalId, company, position, location?, startDate?, endDate?, current, description?, metrics[] }]` — campos estructurales copiados verbátim del perfil; solo `description` puede venir reformulada por la IA.
  - `projects`: `[{ originalId, name, role?, description?, url?, techStack[], metrics[] }]` — verbátim.
  - `skills`: `[{ name }]` — solo skills reales del perfil, ordenadas por reglas del sistema.
  - `education`: `[{ degree, institution, field?, /*...*/ }]`, `certifications`, `languages: [{ name, level }]` — verbátim.
  - `name`/`email` no viven aquí: se toman del `User` al renderizar (patrón SPEC 07).
- `profileSnapshot` y `profileFingerprint`: **se reutilizan** de `backend/src/job-match/profile-util.ts` (SPEC 11); si no están exportados, exportarlos (único cambio de contrato en SPEC 11).
- El texto adaptado queda en el idioma de la oferta (`sourceLanguage`); los nombres propios no se traducen.
- Historial append-only: cada `POST /cv-adaptation` persiste una versión nueva.

## Implementation plan

Cada paso deja el sistema compilable y funcionando.

1. En `backend/prisma/schema.prisma`: agregar el modelo `AdaptedCv` y las relaciones `adaptedCvs` en `User`, `JobOffer` y `JobMatch`. Ejecutar `prisma migrate dev` (nombre `adapted_cv`) y `prisma generate`.
2. Reutilizar utilidades de SPEC 11: exportar desde `backend/src/job-match/profile-util.ts` `profileSnapshot` y `profileFingerprint` (si no lo están). Verificar que `offerSkillWhitelist` (o equivalente) es exportable para reutilizarlo en la priorización de skills.
3. Crear `backend/src/cv-adaptation/dto/cv-adaptation.dto.ts`:
   - `CreateCvAdaptationDto`: `jobOfferId` (`@IsString @IsNotEmpty`), `jobMatchId?` (`@IsOptional @IsString`).
   - `ExportQueryDto` (o reutilizar el patrón de SPEC 07): `format` (`@IsIn(['pdf','docx'])`), `lang?` (`@IsOptional @IsIn(['es','en'])`).
   - `AdaptedCvDto`: serialización (`id`, `jobOfferId?`, `jobMatchId?`, `sourceLanguage`, `content`, `stale`, `createdAt`, `updatedAt`).
4. Crear `backend/src/cv-adaptation/cv-adaptation-rules.ts` (determinista, sin IA):
   - `matchedSkills(profileSkills, offer)` → intersección perfil ∩ whitelist de la oferta.
   - `orderedSkills(profileSkills, offer)` → skills de intersección primero (orden relativo del perfil) y luego el resto.
   - `rankItems(items, matchedSkills, bagOfWords)` → reordena experiencias/proyectos por relevancia (los que citan un matched skill en description/metrics/techStack primero), sin descartar.
   - `offerMissingSkills(offer, match, profileSkills)` → tecnologías de la oferta que el perfil no declara (required + preferred + gaps `MISSING` del match), preservando el casing original; alimentan el `summary`.
   - `buildDeterministicSummary(input)` → resumen server-side en `sourceLanguage` (es/en): rol real, antigüedad solo con fechas reales, skills matcheadas o top del perfil, y línea de compromiso honesta con `missingSkills` (nunca los presenta como poseídos).
5. Crear `backend/src/cv-adaptation/cv-adaptation-parser.service.ts`: inyecta `OpenaiService`; método `adapt(profileSnapshot, offerSnapshot, gapsSnapshot|null, matchedSkills, sourceLanguage)` → structured outputs `{ experienceDescriptions: [{ originalId, text }] }` (el `summary` NO sale de la IA). Prompt: reformular **solo** `experienceDescriptions`, en `sourceLanguage`, integrando keywords de forma natural y profesional; no afirmar skills `MISSING` (del match), no añadir logros/empresas/posiciones/datos ausentes, no tocar métricas. Respuesta no JSON o forma inválida → `BadGatewayException`/422.
6. Crear `backend/src/cv-adaptation/cv-adaptation.service.ts`:
   - `createForOffer(userId, jobOfferId, jobMatchId|null)`: carga `JobOffer` (404 si no existe o es ajena); si `jobMatchId` → carga el `JobMatch` (404 si no existe o es ajeno); arma `profileSnapshot`/`profileFingerprint` del perfil actual; aplica reglas (skills ordenados, items rankeados); construye el `content` base verbátim; llama al parser; **valida** que `experienceDescriptions[].originalId` exista en el snapshot y que los campos estructurales del `content` sean idénticos al snapshot; persiste `AdaptedCv`. Si un `originalId` del parser no está en el snapshot → usar la descripción original (nunca texto huérfano).
   - `list(userId)`, `getById(userId, id)` con `stale` (fingerprint vs actual), `delete(userId, id)`; ownership → 404.
   - `exportCv(userId, id, format, lang)`: carga la versión, arma `CvData` desde `content` + `User.name/email`, delega en `CvExportService.buildPdf/buildDocx`.
7. Crear `backend/src/cv-adaptation/cv-adaptation.controller.ts` y `cv-adaptation.module.ts` (importa `PrismaService`; `OpenaiModule` es global; importa `CvExportModule` para exportar el export service, y `JobMatchModule` solo si hace falta el service); registrarlo en `app.module.ts`:
   - `POST /cv-adaptation` → valida DTO, genera y persiste → 201 con `AdaptedCvDto`.
   - `GET /cv-adaptation` → historial.
   - `GET /cv-adaptation/:id` → detalle con `stale`.
   - `GET /cv-adaptation/:id/export?format=pdf|docx&lang?` → `StreamableFile` (mismo patrón SPEC 07; `lang` default = `sourceLanguage` si es `es`/`en`, si no `es`).
   - `DELETE /cv-adaptation/:id` → borra la versión.
   - Si `CvExportService` no está exportado desde `CvExportModule`, exportarlo (único cambio de contrato en SPEC 07).
8. Tests: `cv-adaptation-parser.service.spec.ts` (OpenAI mockeado: reformula summary/descripciones en el idioma correcto; JSON inválido → 422), `cv-adaptation.service.spec.ts` (persiste; `skills` ⊆ skills del perfil; skill de intersección va primero; empresa/posición/fechas/métricas idénticas al snapshot; `originalId` de la IA desconocido → usa la descripción original; ownership → 404; `stale` refleja huella; export delega en `CvExportService`), e2e `cv-adaptation.e2e-spec.ts` (401 sin cookie; `POST` sin `jobOfferId` → 400; oferta ajena/inexistente → 404; `jobMatchId` ajeno → 404; `POST` con oferta → 201 y persiste; `GET` historial propio; `GET/export/DELETE` de versión ajena → 404; export PDF → 200 con `%PDF` y texto extraído que incluye contenido adaptado; `DELETE` no borra la oferta ni el match).
9. Frontend: `frontend/src/app/core/models/adapted-cv.ts` (tipos `AdaptedCvDto`, adaptaciones del `content`) y `frontend/src/app/cv-adaptation/cv-adaptation.service.ts` (`create(jobOfferId, jobMatchId?)`, `list`, `get(id)`, `download(id, format, lang?)`, `delete(id)`).
10. Frontend UI: página `cv-adaptation.component` standalone (SCSS del scaffold): historial + detalle con el CV estructurado, etiqueta "Adaptado por IA", botones de descarga PDF/DOCX, banner de `stale` con aviso de generar versión nueva. Rutas `/cv-adaptation` y `/cv-adaptation/:id` protegidas en `app.routes.ts`.
11. Frontend enlaces: en el detalle de `JobMatch` (SPEC 11), botón "Adaptar CV" → `create(jobOfferId, matchId)` → navega a `/cv-adaptation/:id`. En `/job-analysis`, por oferta guardada, botón "Adaptar CV" → `create(jobOfferId)` → navega.
12. Verificación final: `npm run build:all`, `npm run lint:all`, `npm run test -w career-analyzer-backend`, y flujo manual (login → `/profile` con skills/experiencias/métricas → `/job-analysis` → analizar una oferta en inglés y guardarla → "Adaptar CV" → ver el detalle con "Adaptado por IA" → descargar PDF/DOCX y verificar que skills de la oferta aparecen primero y el texto es natural → editar un skill en `/profile` → volver → banner de stale → generar versión nueva → ver historial con ambas versiones → borrar una versión → la oferta y el match siguen).

## Acceptance criteria

- [x] El modelo `AdaptedCv` existe en `schema.prisma` con `jobOfferId`/`jobMatchId` nullable y `onDelete: SetNull`; la migración `adapted_cv` está aplicada y el client regenerado.
- [x] `POST /cv-adaptation` con `jobOfferId` → 201 y persiste; sin `jobOfferId` → 400; oferta ajena/inexistente → 404; `jobMatchId` ajeno/inexistente → 404.
- [x] `content.skills` ⊆ skills del perfil (verificable por diff contra `profileSnapshot`) y los skills de la intersección con la oferta aparecen antes que el resto.
- [x] Para cada experiencia/proyecto del `content`, los campos estructurales (empresa, posición, fechas, `metrics`, `techStack`, etc.) son idénticos a los del `profileSnapshot`; `originalId` siempre apunta a un item real del perfil.
- [x] Solo `experiences[].description` puede diferir del snapshot (prosa reformulada por la IA), en el idioma de la oferta (`sourceLanguage`). El `summary` es determinista del sistema (datos reales del perfil + commit line de `missingSkills`), no redactado por IA; los nombres propios no se traducen.
- [x] El adaptado no afirma skills `MISSING` del match usado (si `jobMatchId` viene); texto natural, sin keyword stuffing (revisión en e2e contra prompt/snapshot).
- [x] `GET /cv-adaptation/:id` sirve el guardado e incluye `stale` correcto; `GET /cv-adaptation` devuelve solo versiones del usuario; `GET/export/DELETE` de versión ajena → 404.
- [x] `GET /cv-adaptation/:id/export?format=pdf` → 200, `Content-Type: application/pdf`, body `%PDF` con texto extraído (`pdf-parse`) que contiene el contenido adaptado; `format=docx` → 200 con content-type docx y texto extraído (`mammoth`) equivalente; `format` inválido → 400.
- [x] `DELETE /cv-adaptation/:id` borra la versión y **no** borra la oferta ni el match.
- [x] El adaptado nunca escribe de vuelta al perfil; nada viaja por `localStorage`; el perfil (`/profile`) queda intacto tras una generación.
- [x] `npm run build:all` y `npm run lint:all` OK; `npm run test -w career-analyzer-backend` pasa (unit + e2e).
- [x] Frontend: botones "Adaptar CV" en detalle del match y en historial de ofertas; `/cv-adaptation/:id` muestra el CV estructurado con etiqueta "Adaptado por IA" y botones de descarga; banner de `stale` invita a generar versión nueva; sin sesión redirige a `/auth/login`.

## Decisions

- **Sí:** versión **persistida** (`AdaptedCv`) con historial por usuario/oferta y exportación PDF/DOCX reutilizando SPEC 07/09. El README pide "múltiples versiones de CV para distintas postulaciones"; el usuario confirmó que el resultado se guarda y es descargable con la plantilla existente (sin nuevos templates ni librerías).
- **Sí:** **reglas del sistema seleccionan/ordenan; la IA solo reformula** `experiences[].description`. El usuario confirmó esta división: limita la superficie de invención a un campo de prosa y hace el resto verificable por diff estructurado. Elegir items y orden por reglas deterministas evita que la IA descarte experiencia real.
- **Sí (ajuste aprobado): `summary` determinista del sistema, no de la IA.** Descubierto que la IA inventaba skills (p. ej. Python/Django/FastAPI/PostgreSQL) al redactar el resumen. El usuario aprobó que el sistema construya el summary con datos reales (rol, antigüedad real, skills matcheadas o top del perfil) y una línea de compromiso honesta cuando faltan skills de la oferta ("Compromiso con el aprendizaje de X"), eliminando la invención por diseño y dejando la superficie de IA solo en `experiences[].description`.
- **Sí:** idioma del texto adaptado = **idioma de la oferta** (`sourceLanguage`), con los títulos de sección en la exportación siguiendo ese idioma cuando es es/en. El usuario confirmó el caso de uso real: postularse en el idioma de la oferta; es coherente con la invariante de traducción natural, no literal.
- **Sí:** garantía no-inventar server-side análoga a SPEC 11: `skills` construidos solo desde el perfil (whitelist + reorder, no IA), campos estructurales copiados verbátim y validados contra el snapshot, prosa restringida por prompt y auditable vía `profileSnapshot`/`offerSnapshot`.
- **Sí:** distintivo de origen: el adaptado es un artefacto persistido etiquetado **"Adaptado por IA"**; el perfil es intocable. Se respeta la invariante de distinguir contenido generado del provisto por el usuario.
- **Sí:** se **reutilizan** `profileSnapshot`/`profileFingerprint` y la novedad de `stale` de SPEC 11, y la plantilla de SPEC 07/09. Sin código duplicado; los únicos cambios de contrato son exportar utilidades/servicios ya existentes.
- **Sí:** `jobMatchId` como entrada opcional (gaps informan qué **no** afirmar). El usuario confirmó disparar desde el match y desde la oferta: el match enriquece el prompt; sin él, la adaptación funciona igual con la oferta.
- **No:** recompute sobre la versión. Cambió el perfil → generar una versión nueva (append-only); `stale` solo informa. Simple y coherente con el historial.
- **No:** escribir el adaptado de vuelta al perfil, cover letters, edición manual de la versión, comparación/diff visual, cursos para cerrar gaps, múltiples templates — cada uno a su spec.
- **No:** librerías UI nuevas; SCSS del scaffold (patrón del resto de specs).

## Risks

| Riesgo | Mitigación |
| --- | --- |
| La IA inventa logros/empresas/posiciones al reformular | La IA solo recibe `profileSnapshot`+`offerSnapshot`+gaps; solo toca `experiences[].description`; el servidor valida que los campos estructurales del `content` sean idénticos al snapshot. |
| La IA afirma un skill `MISSING` (lo tiene la oferta pero no el candidato) | El prompt recibe los gaps del `jobMatchId` y prohíbe afirmar skills `MISSING`; `skills` del `content` salen de reglas server-side, no de la IA. |
| Keyword stuffing en la reescritura | Prompt explícito de lenguaje natural/profesional; criterio de aceptación de revisión contra prompt; el adaptado se genera sobre la prosa real del perfil. |
| Skills duplicados o inventados en la lista | `content.skills` se construye por reglas desde los skills del perfil (whitelist ∩ + reorder), nunca desde la IA. |
| `originalId` desconocido devuelto por la IA | El service valida contra el snapshot; ante un id inválido usa la descripción original (nunca texto huérfano). |
| El perfil cambia tras la generación | `profileFingerprint` al guardar; `GET` compara y devuelve `stale`; la UI invita a generar una versión nueva. |
| Borrar la oferta o el match rompe la versión | `onDelete: SetNull` + `content` autocontenido y snapshots; el CV sigue legible y exportable. |
| Costo de las llamadas de IA | Generación a demanda (`POST`); `GET`/export nunca disparan IA; el historial sirve versiones guardadas. |
| Traducción del contenido a un idioma que no domina el modelo | Prompt de adaptación natural; los nombres propios no se traducen; la versión queda auditable contra el snapshot para revisión humana. |

## What is **not** in this spec

- Cover letters y cartas de motivación.
- Aplicar el adaptado de vuelta al perfil (la IA no edita datos).
- Edición manual de la versión adaptada (preview editable) ni diff visual entre versiones.
- Recomendaciones de cursos/certificaciones para cerrar gaps.
- Múltiples templates o estilos de CV.
- Recomputation sobre una versión existente (se genera una nueva).

Cada uno, si llega, tendrá su propio spec.