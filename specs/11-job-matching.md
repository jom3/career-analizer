# SPEC 11 — Job matching (encaje candidato ↔ oferta)

> **Status:** Implemented
> **Depends on:** SPEC 03, SPEC 05, SPEC 10
> **Date:** 2026-08-09
> **Objective:** Calcular y persistir el encaje entre el Candidate Profile y una oferta de trabajo —score global y por dimensión, gaps de skills, y recomendaciones de mejora— con la IA, garantizando que los gaps salen solo de skills presentes en la oferta y que el resultado queda auditable contra el perfil y la oferta usados.

## Scope

**In:**

- Backend: modelo `JobMatch` en Prisma (resultado persistido por usuario, con snapshot de la oferta y huella del perfil), con migración.
- Entrada del match —**un solo endpoint** `POST /job-match`:
  - **`jobOfferId`**: id de una oferta guardada del usuario (SPEC 10). Se carga la `JobOffer`; si no existe o no es del usuario → 404.
  - **`offer` (draft estructurado)**: el borrador editado por el usuario (mismo contrato que `JobOfferDto` de SPEC 10 + `rawInput`/`sourceLanguage` opcionales). Cubre el "texto al vuelo": el frontend analiza el texto con SPEC 10, el usuario revisa/edita el preview, y ese draft es la entrada del match — sin re-parsear texto ni pagar otra llamada de parseo.
  - El draft estructurado es la **fuente de verdad del match**: evita inventos (invariante del README) y mantiene la auditoría con `rawInput`.
- Análisis con IA vía `OpenaiService` (SPEC 03) usando **structured outputs**: dado `option` (draft estructurado de la oferta) y `profile` (vista agregada del Candidate Profile, SPEC 05), produce:
  - `overallScore` (0–100) y `overallJustification` (texto).
  - **`dimensions`**: `skills`, `experience`, `education`, `languages` — cada una con `score` (0–100) y `justification`. Solo hay puntaje sobre dimensiones con datos; dimensiones vacías en el perfil → `score: null` y justificación que lo explica.
  - **`gaps`**: skills de la oferta comparados contra el perfil, cada uno con `name`, `status` (`HAVE`/`MISSING`/`PARTIAL`), `source` (`REQUIRED`/`PREFERRED`/`OTHER`) y `note` opcional. **Los `name` de gaps provienen estrictamente de los skills declarados en la oferta** (`requiredSkills`/`preferredSkills` y skills citados en `experienceSummary`); el servidor los filtra contra esa lista (whitelist) — la IA nunca inventa un gap fuera de la oferta. `PARTIAL`/`HAVE` se deciden cruzando con los skills reales del perfil.
  - **`recommendations`**: lista de `{ type, target, suggestion }`, con `type: SKILL` (derivadas de un gap: qué abordar, cómo demostrarlo en el perfil) y `type: PROFILE` (mejoras de perfil sugeridas por IA — cuantificar métricas, añadir certificaciones, completar resumen, etc.). Siempre **sugerencias, nunca se aplican** (invariante: la IA no modifica datos sin confirmación humana; se distinguen del dato del usuario).
- Idioma del análisis: los textos (`justification`, `note`, `suggestion`) se escriben en el idioma de la interfaz (`lang: 'es' | 'en'`, query/body param, default `es`, mismo patrón que SPEC 07). Los nombres de skills/gaps se respetan tal cual vienen de perfil y oferta.
- Persistencia: `JobMatch` por cálculo (historial append-only por usuario). Algoritmo de "servir guardado + recalcular bajo demanda":
  - `POST /job-match` → **calcula fresco** y persiste un `JobMatch` nuevo.
  - `GET /job-match/:id` → sirve el guardado; compara la **huella del perfil** actual contra la guardada y devuelve `stale: boolean` (si el perfil cambió) sin recalcular.
  - `POST /job-match/:id/recompute` → recalcula y reemplaza el contenido (mismo id).
  - El resultado queda auditable: `offerSnapshot`, `profileSnapshot` (vista agregada usada) y `profileFingerprint` se persisten con el match.
- API REST protegido por el guard global (cookie, SPEC 04):
  - `POST /job-match` → calcula y persiste; body: `{ jobOfferId }` **o** `{ offer, rawInput?, saveOffer?, lang? }`. Sin una u otra → 400; ambas → 400. `saveOffer: true` persiste el draft como `JobOffer` (inputType `TEXT`, `rawInput` obligatorio) y vincula el match a ella.
  - `GET /job-match` → historial del usuario (desc por `createdAt`).
  - `GET /job-match/:id` → match del usuario autenticado (404 si es de otro o no existe); incluye `stale`.
  - `POST /job-match/:id/recompute` → recalcula con el perfil actual.
  - `DELETE /job-match/:id` → borra un match guardado (solo el match, **no** la oferta).
- Frontend:
  - Página `/job-match` (SCSS del scaffold, sin librerías UI) que lista el historial de matches; cada fila abre el detalle.
  - Detalle `/job-match/:id`: score global grande, barras por dimensión con justificación, lista de gaps con badges `HAVE`/`MISSING`/`PARTIAL` (y origen `REQUIRED`/`PREFERRED`), recomendaciones separando `SKILL`/`PROFILE`, banner de `stale` con botón "Recalcular".
  - En `/job-analysis` (SPEC 10): botón **"Ver compatibilidad"** por oferta guardada → crea u abre el match; en el preview editable del análisis, botones **"Guardar y ver compatibilidad"** (persiste la oferta con SPEC 10 y matchea) y **"Match sin guardar"** (envía el draft editado a `POST /job-match`, sin persistir la oferta).
- Tests: unitarios del parser (OpenAI mockeado: score válido, gap fuera de la oferta filtrado, JSON inválido → error), del service (persiste, filtra whitelist, huella/stale, ownership, `saveOffer`), y e2e del flujo completo.

**Out of scope (para specs futuros):**

- CV adaptado a la oferta (keywords/tailoring) y cover letters — feature MVP propia.
- Recomendaciones de cursos/recursos externos o marketplace de aprendizaje.
- Aplicación automática de recomendaciones/sugerencias sobre el perfil.
- Comparación entre ofertas ni ranking global de candidatos.
- Re-análisis automático del match en cada `GET` (el `stale` informa; recalcular es explícito).

## Data model

Agregar el modelo `JobMatch` más las relaciones en `User` y `JobOffer`:

```prisma
model User {
  // ... campos de SPEC 04/05/06/10
  jobMatches JobMatch[]
}

model JobOffer {
  // ... campos de SPEC 10
  jobMatches JobMatch[]
}

model JobMatch {
  id                   String   @id @default(cuid())
  userId               String
  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  jobOfferId           String?
  jobOffer             JobOffer? @relation(fields: [jobOfferId], references: [id], onDelete: SetNull)
  lang                 String   @default("es")
  overallScore         Int
  overallJustification String   @db.Text
  dimensions           Json     // [{ key, score|null, justification }]
  gaps                 Json     // [{ name, status, source, note? }]
  recommendations      Json     // [{ type, target, suggestion }]
  offerSnapshot        Json     // draft estructurado fuente del match
  profileSnapshot      Json     // vista agregada del perfil usada al calcular
  profileFingerprint   String   // huella del perfil al momento del análisis
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}
```

Convenciones:

- `jobOfferId` **nullable**: matchear un draft sin guardar no crea `JobOffer`; el match queda autocontenido con `offerSnapshot`.
- `onDelete: SetNull`: borrar una oferta (SPEC 10) no borra el historial de matches.
- `dimensions`: array JSON fijo con las claves `skills`, `experience`, `education`, `languages`; cada una `{ key, score: number|null, justification }`. `score: null` cuando la dimensión no tiene datos en el perfil.
- `gaps`: array JSON; campos `{ name, status: 'HAVE'|'MISSING'|'PARTIAL', source: 'REQUIRED'|'PREFERRED'|'OTHER', note?: string }`.
- `recommendations`: array JSON; `{ type: 'SKILL'|'PROFILE', target: string, suggestion: string }`.
- `profileFingerprint`: hash determinista (p. ej. SHA-256) de una cadena normalizada de los campos del perfil que afectan al matching (nombres de skills y niveles, posiciones/empresas de experiencia, grados de educación, idiomas). Sobre él se decide `stale`.
- `lang` en el match identifica el idioma en que se escribieron las justificaciones/recomendaciones de ese cálculo.
- Historial append-only: cada `POST /job-match` persiste un match nuevo; `recompute` reemplaza el contenido del id existente.

## Implementation plan

Cada paso deja el sistema compilable y funcionando.

1. En `backend/prisma/schema.prisma`: agregar el modelo `JobMatch` y las relaciones `jobMatches` en `User` y `JobOffer`. Ejecutar `prisma migrate dev` (nombre `job_match`) y `prisma generate`.
2. Crear `backend/src/job-match/dto/job-match.dto.ts`:
   - `JobMatchRequestDto`: `jobOfferId?` (`@IsOptional @IsString`), `offer?` (objeto con los mismos campos que `JobOfferDto` de SPEC 10 + `rawInput?`, `sourceLanguage?`, `inputType?`), `saveOffer?` (`@IsOptional @IsBoolean`), `lang?` (`@IsOptional @IsIn(['es','en'])`). Validación custom: exactamente una de `jobOfferId`/`offer` presente; `saveOffer: true` requiere `offer` y `rawInput` no nulo.
   - `JobMatchDto`: serialización del match (`id`, `jobOfferId?`, `lang`, `overallScore`, `overallJustification`, `dimensions`, `gaps`, `recommendations`, `stale`, `createdAt`, `updatedAt`).
3. Crear `backend/src/job-match/profile-util.ts`:
   - `profileSnapshot(profile)` → vista agregada normalizada: skills `{ name, level }`, experiencias `{ position, company, description, metrics }`, educación `{ degree, field, institution }`, certificaciones `{ name }`, proyectos `{ name, techStack, description }`, idiomas `{ name, level }`.
   - `profileFingerprint(snapshot)` → SHA-256 de la concatenación normalizada de los campos del snapshot.
   - `offerSkillWhitelist(offer)` → conjunto de skills de la oferta (`requiredSkills` + `preferredSkills` + tokens de skills citados en `experienceSummary`).
4. Crear `backend/src/job-match/job-match-parser.service.ts`: inyecta `OpenaiService`; método `match(offerSnapshot, profileSnapshot, lang)` → structured outputs con JSON Schema `{ overallScore, overallJustification, dimensions[], gaps[], recommendations[] }`. Prompt: score evidenciado en el perfil (dimensiones vacías → `score: null`), nombres de gaps tomados solo de los skills de la oferta, `status` cruzado contra los skills reales del perfil, recomendaciones en prosa natural/profesional en `lang`, sin inventar experiencia ni recursos externos. Respuesta no JSON o forma inválida → `BadGatewayException`/422.
5. Crear `backend/src/job-match/job-match.service.ts`:
   - `createForOffer(userId, jobOfferId, lang)`: carga la `JobOffer` (404 si no existe o es ajena), arma el snapshot/fingerprint del perfil, llama al parser, aplica la whitelist a `gaps` (descarta nombres fuera de la oferta; si el array queda vacío se conserva el resultado con `gaps: []`), persiste el `JobMatch`.
   - `createForDraft(userId, offerDto, rawInput, saveOffer, lang)`: si `saveOffer` → persiste la `JobOffer` (inputType `TEXT`, `rawInput`) y usa su id; si no → `offerSnapshot` = draft. Calcula igual que el anterior.
   - `getById(userId, id)` con `stale` = `profileFingerprint != profileFingerprint(profileSnapshot(perfil actual))`; `list(userId)`; `updateResult(id, ...)` usado por recompute; `delete(userId, id)`. Ownership: ids de otro usuario → 404.
6. Crear `backend/src/job-match/job-match.controller.ts` y `job-match.module.ts` (importa `PrismaService`; `OpenaiModule` ya es global; registrarlo en `app.module.ts`):
   - `POST /job-match` → valida `JobMatchRequestDto`, calcula y persiste → 201 con `JobMatchDto`.
   - `GET /job-match` → historial.
   - `GET /job-match/:id` → match con `stale`.
   - `POST /job-match/:id/recompute` → recalcula con perfil actual y devuelve el match actualizado (mismo id).
   - `DELETE /job-match/:id` → borra el match (no la oferta).
7. Tests: `job-match-parser.service.spec.ts` (OpenAI mockeado: respuesta válida → parseo de scores/gaps/recomendaciones; gap fuera de la oferta → el service lo filtra; JSON inválido → 422), `job-match.service.spec.ts` (crea y persiste, `saveOffer` persiste `JobOffer`, whitelist filtra gaps, ownership → 404, `stale` refleja cambio de huella), e2e `job-match.e2e-spec.ts` (401 sin cookie; `POST` sin `jobOfferId` ni `offer` → 400; ambas → 400; `jobOfferId` ajeno → 404; con `offer` → 201 y persiste; `GET /job-match` → historial propio; `GET/PUT recompute/DELETE` de match ajeno → 404; borrar match no borra la oferta).
8. Frontend: `frontend/src/app/core/models/job-match.ts` (tipos `JobMatchDto`, `JobMatchDimension`, `JobMatchGap`, `JobMatchRecommendation`) y `frontend/src/app/job-match/job-match.service.ts` (`create(jobOfferId | offer, lang?)`, `list`, `get(id)`, `recompute(id)`, `delete(id)`).
9. Frontend UI: página `job-match.component` standalone (SCSS del scaffold): historial + detalle con score global, dimensiones, gaps, recomendaciones y banner de `stale` con "Recalcular". Ruta `/job-match` y `/job-match/:id` protegidas en `app.routes.ts`; enlace desde el dashboard.
10. Frontend en `/job-analysis`: en cada oferta guardada del historial, botón "Ver compatibilidad" → `create(jobOfferId)` o `get` del match más reciente → navega a `/job-match/:id`. En el preview editable del análisis: "Guardar y ver compatibilidad" (guarda con SPEC 10 y luego matchea) y "Match sin guardar" (envía el draft editado a `create(offer)`).
11. Verificación final: `npm run build:all`, `npm run lint:all`, `npm run test -w career-analyzer-backend`, y flujo manual (login → `/profile` con skills → `/job-analysis` → analizar una oferta → "Guardar y ver compatibilidad" → ver scores/gaps/recomendaciones → editar un skill en `/profile` → volver al match → banner de stale → "Recalcular" → cambia el resultado → probar "Match sin guardar" con otro texto → aparece en el historial sin oferta persistida → borrar un match → la oferta sigue en el historial).

## Acceptance criteria

- [ ] El modelo `JobMatch` existe en `schema.prisma` con `jobOfferId` nullable y `onDelete: SetNull`; la migración `job_match` está aplicada y el client regenerado.
- [ ] `POST /job-match` con `jobOfferId` (oferta del usuario) → 201 y persiste; con `jobOfferId` ajeno o inexistente → 404; sin `jobOfferId` ni `offer` → 400; con ambas → 400.
- [ ] `POST /job-match` con `offer` (draft estructurado) calcula sin re-parsear texto; con `saveOffer: true` persiste la `JobOffer` (con `rawInput`) y vincula el match; con `saveOffer: false` no crea oferta y el match queda con `jobOfferId: null`.
- [ ] El resultado incluye `overallScore` (0–100), `overallJustification` y `dimensions` con las claves `skills`/`experience`/`education`/`languages` (score o `null` si la dimensión no tiene datos).
- [ ] Todos los `gaps[].name` están presentes en la whitelist de la oferta (`requiredSkills` + `preferredSkills` + skills citados en `experienceSummary`); nunca un skill inventado. Batch de revisión: comparar `gaps` vs `offerSnapshot`.
- [ ] Los `recommendations` son solo sugerencias (`type: SKILL`/`PROFILE`, `target`, `suggestion`) en el idioma de `lang`; no modifican el perfil ni contienen enlaces/recursos externos inventados.
- [ ] `GET /job-match/:id` sirve el guardado e incluye `stale` correcto; `POST /job-match/:id/recompute` recalcula y preserva el id; `GET /job-match` devuelve solo matches del usuario; `GET/DELETE/recompute` de un match ajeno → 404.
- [ ] `DELETE /job-match/:id` borra el match y **no** la oferta asociada.
- [ ] `npm run build:all` y `npm run lint:all` OK; `npm run test -w career-analyzer-backend` pasa (unit + e2e).
- [ ] `/job-analysis` permite "Ver compatibilidad" por oferta, "Guardar y ver compatibilidad" y "Match sin guardar"; `/job-match` y `/job-match/:id` muestran scores, gaps y recomendaciones con banner de stale y recalcular; sin sesión redirige a `/auth/login`.
- [ ] No se usa `localStorage` para matches; todo viaja por la API.

## Decisions

- **Sí:** matching + gap analysis + recomendaciones en el **mismo spec**. El usuario lo confirmó: son la misma inquietud ("qué es lo que tenemos, qué no, qué mejorar") y un solo call de IA las produce; partirlos habría duplicado llamadas y contratos.
- **Sí:** entrada por oferta guardada **y** por draft estructurado (sin re-parsear texto). El usuario pidió el "texto al vuelo" con opción de guardar y saltar, o matchear sin guardar. Usar el draft editado (mismo contrato que SPEC 10) preserva el gate humano y la auditoría (`rawInput`), y evita pagar dos análisis IA por la misma oferta.
- **Sí:** resultado **persistido** con `offerSnapshot`/`profileSnapshot`/`profileFingerprint`. El README exige que el contenido generado quede fiel a los datos reales; guardar lo que se usó hace cada match auditable y el historial consultable sin re-cargar la API.
- **Sí:** "servir guardado + recalcular bajo demanda" con huella del perfil. Un `GET` no dispara IA (costo); `stale` informa del cambio y `recompute` es explícito. Coherente con la decisión de persistir.
- **Sí:** score global + por dimensión + justificaciones, en el idioma de la interfaz (`lang`, patrón SPEC 07). El usuario lo leyó a mano, no un ATS.
- **Sí:** `gaps` estructurados y **filtrados con whitelist** contra los skills de la oferta. Es la garantía verificable de la invariante "no inventar": aunque la IA se equivoque, el servidor descarta cualquier gap que no esté en la oferta.
- **Sí:** recomendaciones solo como sugerencias (`SKILL`/`PROFILE`), nunca aplicadas. La IA no modifica datos sin confirmación; el perfil sigue siendo la única fuente de verdad editada por el usuario.
- **Sí:** historial append-only (`POST` crea match nuevo; `recompute` reemplaza el id). Simple, sin unique-null leak en Postgres y con trazabilidad de versiones del cálculo.
- **No:** CV adaptado/tailoring, cover letters, cursos/recursos externos, auto-aplicación de mejoras, recálculo automático en GET, comparación entre ofertas — cada uno a su spec.
- **No:** librerías UI nuevas; SCSS del scaffold (patrón del resto de specs).

## Risks

| Riesgo | Mitigación |
| --- | --- |
| La IA inventa gaps no presentes en la oferta | Prompt restrictivo + **whitelist server-side** sobre `requiredSkills`+`preferredSkills`+skills del `experienceSummary`; si el array queda vacío, `gaps: []`. |
| La IA inventa experiencia/habilidades al justificar | El parser solo recibe `profileSnapshot` (datos reales) y la oferta; el prompt prohíbe añadir logros; `recommendations` son sugerencias, no afirmaciones de experiencia. |
| Escala de scores arbitraria o sesgada | Esquema fijo 0–100, evidenciado en el perfil; `justification` referencia items reales (posición, empresa, skill) que el evaluador puede verificar. |
| Dimensiones sin datos en el perfil | `score: null` + justificación explicando la ausencia; la UI lo distingue de un puntaje bajo. |
| El perfil cambia y el match queda viejo | `profileFingerprint` al calcular; `GET` compara y devuelve `stale`; la UI ofrece "Recalcular" (\(POST /recompute\)). |
| Costo de las llamadas de IA | El match se calcula a demanda (`POST`/`recompute`); `GET` nunca dispara IA; el historial sirve resultados guardados. |
| `saveOffer` sin `rawInput` | DTO impide `saveOffer: true` sin `offer` y `rawInput`; la auditoría de SPEC 10 se mantiene. |
| Borrar la oferta rompe el match | `onDelete: SetNull` + `offerSnapshot` autocontenido; el match sigue legible aunque la oferta se borre. |

## What is **not** in this spec

- CV adaptado a la oferta (keywords, tailoring) y cover letters.
- Recomendaciones de cursos, certificaciones externas o recursos de aprendizaje.
- Aplicación automática de sugerencias de mejora sobre el perfil.
- Comparación entre ofertas o ranking de candidatos.
- Re-análisis automático del match en cada lectura.

Cada uno, si llega, tendrá su propio spec.