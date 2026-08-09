# SPEC 09 — Formato del CV generado

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 07
> **Date:** 2026-08-08
> **Objective:** Ajustar la exportación del CV (SPEC 07) para que los skills se agrupen en párrafos por categorías legibles para ATS y humanos, que las métricas de experiencias y proyectos aparezcan solo cuando el perfil las declara, y que las fechas de items solapados se presenten con claridad, con aviso suave en el editor del perfil.

## Scope

**In:**

- Backend (Prisma): campo opcional `metrics String[]` en `Experience` y `Project`, con migración.
- DTOs de perfil (SPEC 05): `ExperienceDto` y `ProjectDto` con `metrics?: string[]` (`@IsOptional @IsArray @IsString({ each: true }) @ArrayMaxSize(5)`).
- `cv-export.service` (SPEC 07), en PDF y DOCX:
  - **Skills agrupados por categorías:** uno o varios párrafos `Categoría: skill1, skill2, ...` separados por comas (nunca uno por línea). Con <4 skills un solo grupo; con 4+ la agrupación la hace `CvSkillGroupingService` (IA con structured outputs + guardia determinista), con fallback a un único grupo con todas las skills reales ante fallo o respuesta inválida. La guardia solo admite nombres de skills reales del perfil (case-insensitive, preservando casing/orden originales), descarta categorías inventadas y agrega las skills omitidas al final. Idiomas conservan `name (CEFR)`.
  - Experiencias y proyectos con `metrics` no vacías renderizan bullets bajo la descripción; si `metrics` viene vacío o ausente, no se renderiza nada. Nunca se inventan, sugieren ni generan métricas.
  - Fechas por item: `current: true` → `MM/YYYY — Actualidad` (es) / `MM/YYYY — Present` (en); el resto → `MM/YYYY — MM/YYYY`. Formato claro por item, sin inferencias de solapamiento.
- Frontend `/profile` (SPEC 05):
  - Editores de experiencia y proyecto con lista editable de métricas (alta/borrado de textos).
  - Aviso suave (no bloqueante) cuando dos experiencias se solapan temporalmente (rango compartido: `startDate`–`endDate`/`current` hasta hoy); se muestra un warning inline y se permite guardar igualmente.
- Tests: unitarios de `CvExportService` (skills en párrafos por categoría con fallback, idiomas con CEFR, métricas renderizadas/vacías, fechas con `current` en es/en), unitarios de `CvSkillGroupingService` (agrupa, descarta inventadas, fallback) y e2e de export verificando el texto extraído.

**Out of scope (para specs futuros):**

- CV adaptado a una oferta (keywords, matching, tailoring) — feature MVP propia con su spec.
- Múltiples templates o estilos seleccionables.
- Traducción del contenido del perfil (SPEC 07 solo traduce títulos).
- Enriquecimiento o sugerencia de métricas por IA — prohibido por invariante.
- Validación bloqueante de solapamientos de fechas.
- Dedupe en el generador: el perfil se limpia en el spec de calidad de datos (SPEC 08); el generador deriva del perfil tal cual.

## Data model

Agregar un campo a los modelos `Experience` y `Project` de `backend/prisma/schema.prisma`:

```prisma
model Experience {
  // ... campos de SPEC 05/06
  metrics String[]
}

model Project {
  // ... campos de SPEC 05/06
  metrics String[]
}
```

Convenciones:

- `metrics`: lista opcional de textos cortos con logros cuantificables que el usuario declara explícitamente. Vacía o ausente → el render omite la sección.
- El campo es de perfil (fuente de verdad); la exportación solo lo refleja.
- Los skills del CV se agrupan por categorías (párrafos legibles para ATS, sin lista uno-por-línea que los ATS pueden separar). `skillGroups` es derivado en el servidor al exportar (nunca se persiste en el perfil); el perfil conserva la lista llana de skills (fuente de verdad). La agrupación por IA nunca inventa skills; la guardia garantiza que solo se listan skills reales.

## Implementation plan

Cada paso deja el sistema compilable y funcionando.

1. En `backend/prisma/schema.prisma`: agregar `metrics String[]` a `Experience` y `Project`. Ejecutar `prisma migrate dev` (nombre `experience_project_metrics`) y `prisma generate`.
2. En `backend/src/profile/dto/profile.dto.ts`: agregar `metrics` a `ExperienceDto` y `ProjectDto` con `@IsOptional @IsArray @IsString({ each: true }) @ArrayMaxSize(5)`. Actualizar `frontend/src/app/core/models/profile.ts` con `metrics: string[]`.
3. En `backend/src/cv-export/cv-export.service.ts`:
   - Render de skills en párrafos por categorías: `CvData.skillGroups` (o pendiente de resolver del perfil) → un párrafo por grupo (`Categoría: skill1, skill2, ...`); fallback un único párrafo con todas las skills en comas. Crear `backend/src/cv-export/cv-skill-grouping.service.ts` (IA + guardia determinista + fallback) y registrarlo en `CvExportModule`. Idiomas: `name (CEFR)`.
   - Bajo la descripción de experiencia/proyecto con `metrics` no vacías → bullets (`• <metric>`); omitir si vacío/ausente.
   - Fechas por item según `current` y `lang` (`Actualidad`/`Present`). Actualizar los tests existentes que esperaban una skill por línea o `(n/5)`.
4. Frontend `/profile`: en los editores de experiencia y proyecto, agregar la lista editable de métricas (input + botón agregar + botón borrar por item). El guardado lleva `metrics` en el `PUT /profile`.
5. Frontend: crear `frontend/src/app/core/overlap-warning.ts` con `overlappingExperiences(experiences)` que devuelve los pares cuyo rango temporal se solapa (fechas no nulas; `current` extiende hasta hoy). En `profile.component`, mostrar un warning inline al lado de cada experiencia involucrada; no bloquea el guardado.
6. Verificación final: `npm run build:all`, `npm run lint:all`, `npm run test -w career-analyzer-backend`, y flujo manual (login → `/profile` con una experiencia freelance `current` y otra empleo solapada → ver el warning suave y guardar; exportar PDF/DOCX → skills sin nivel, idiomas con CEFR, métricas como bullets solo donde existen, fechas con `Actualidad`/`Present` según `lang`).

## Acceptance criteria

- [x] El campo `metrics` existe en `Experience` y `Project`; la migración `experience_project_metrics` está aplicada y el client regenerado.
- [x] `PUT /profile` acepta y persiste `metrics` (hasta 5 por item); `GET /profile` las devuelve; más de 5 → 400.
- [x] En el PDF y el DOCX, los skills se renderizan en párrafos por categorías (`Categoría: skill1, skill2, ...`, nunca uno por línea; un solo grupo con <4 skills o ante fallo de la IA) y los idiomas como `name (CEFR)`.
- [x] Experiencias y proyectos con `metrics` no vacías muestran bullets; sin `metrics` no aparece sección de métricas; el texto extraído del PDF/DOCX (`pdf-parse`/`mammoth`) incluye las métricas solo si están en el perfil.
- [x] `current: true` → `MM/YYYY — Actualidad` (es) y `MM/YYYY — Present` (en); fechas correctas por item en ambos idiomas.
- [x] En `/profile`, dos experiencias con rango solapado muestran un warning inline; el guardado funciona igualmente.
- [x] `npm run build:all` y `npm run lint:all` OK; `npm run test -w career-analyzer-backend` pasa (unit + e2e).

## Decisions

- **Sí:** omitir el nivel en los skills del CV generado, conservando el nivel en el perfil. El usuario confirmó que el nivel no aporta en el documento; los idiomas conservan CEFR por ser estándar.
- **Sí (ajuste aprobado): skills en párrafos agrupados por categorías.** El usuario pidió reemplazar la lista de skills del documento por párrafos tipo `Categoría: Angular, TypeScript, ...` (3-4 categorías, legible para ATS y humanos), para el CV base y el adaptado a oferta. La agrupación la hace `CvSkillGroupingService` (IA + guardia determinista que solo admite skills reales), con fallback a un único párrafo ante fallo; el perfil sigue siendo la lista llana de skills (fuente de verdad).
- **Sí:** campo estructurado `metrics String[]` en `Experience` y `Project`. El usuario declara las métricas explícitamente en el perfil; el render solo las muestra si existen. Nunca se inventan (invariante del README).
- **Sí:** fechas por item con `current` → `Actualidad`/`Present`. El solapamiento (p. ej. freelance + empleo) es legítimo y se muestra tal cual, con aviso suave no bloqueante en el editor.
- **Sí:** aviso suave en el editor en lugar de validación bloqueante. Un solapamiento real no debe impedir guardar un perfil válido.
- **No:** generación o sugerencia de métricas por IA, varios templates, traducción de contenido, tailoring por oferta, dedupe en el generador — cada uno a su spec.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Perfiles existentes sin `metrics` | Campo opcional; el render omite la sección cuando viene vacío/ausente. |
| `PUT` con payload viejo (sin `metrics`) | Validación `@IsOptional`; el upsert persiste array vacío. |
| Skills sin nivel pierden información para un rol específico | El nivel sigue en el perfil (fuente de verdad); el spec de CV adaptado por oferta puede reintroducir el matiz si se decide. |
| La IA de agrupación duplica o inventa skills | Guardia determinista: solo admite nombres verbatim del perfil, dedupe case-insensitive, respeta casing/orden; las skills omitidas se agregan al final; ante fallo/JSON inválido → un solo grupo con todas las skills reales. |
| Duplicados visibles en el CV si el perfil está sucio | Se resuelven con la limpieza manual del spec de calidad de datos (SPEC 08); el generador no deduce. |

## What is **not** in this spec

- CV adaptado a una oferta (keywords, matching, tailoring).
- Múltiples templates o estilos seleccionables.
- Traducción del contenido del perfil (solo títulos, ya en SPEC 07).
- Generación o sugerencia de métricas por IA.
- Validación bloqueante de solapamientos.
- Dedupe de items en el generador (perfil se limpia en SPEC 08).

Cada uno, si llega, tendrá su propio spec.
