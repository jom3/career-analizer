# SPEC 09 — Formato del CV generado

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 07
> **Date:** 2026-08-08
> **Objective:** Ajustar la exportación del CV (SPEC 07) para que los skills se rendericen sin nivel, que las métricas de experiencias y proyectos aparezcan solo cuando el perfil las declara, y que las fechas de items solapados se presenten con claridad, con aviso suave en el editor del perfil.

## Scope

**In:**

- Backend (Prisma): campo opcional `metrics String[]` en `Experience` y `Project`, con migración.
- DTOs de perfil (SPEC 05): `ExperienceDto` y `ProjectDto` con `metrics?: string[]` (`@IsOptional @IsArray @IsString({ each: true }) @ArrayMaxSize(5)`).
- `cv-export.service` (SPEC 07), en PDF y DOCX:
  - Skills como `name` únicamente, sin `(n/5)`. Idiomas conservan `name (CEFR)`.
  - Experiencias y proyectos con `metrics` no vacías renderizan bullets bajo la descripción; si `metrics` viene vacío o ausente, no se renderiza nada. Nunca se inventan, sugieren ni generan métricas.
  - Fechas por item: `current: true` → `MM/YYYY — Actualidad` (es) / `MM/YYYY — Present` (en); el resto → `MM/YYYY — MM/YYYY`. Formato claro por item, sin inferencias de solapamiento.
- Frontend `/profile` (SPEC 05):
  - Editores de experiencia y proyecto con lista editable de métricas (alta/borrado de textos).
  - Aviso suave (no bloqueante) cuando dos experiencias se solapan temporalmente (rango compartido: `startDate`–`endDate`/`current` hasta hoy); se muestra un warning inline y se permite guardar igualmente.
- Tests: unitarios de `CvExportService` (skills sin nivel, idiomas con CEFR, métricas renderizadas/vacías, fechas con `current` en es/en) y e2e de export verificando el texto extraído.

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
- No cambia `skill.level` (sigue en el perfil, 1–5); solo cambia el render del CV, que lo omite.

## Implementation plan

Cada paso deja el sistema compilable y funcionando.

1. En `backend/prisma/schema.prisma`: agregar `metrics String[]` a `Experience` y `Project`. Ejecutar `prisma migrate dev` (nombre `experience_project_metrics`) y `prisma generate`.
2. En `backend/src/profile/dto/profile.dto.ts`: agregar `metrics` a `ExperienceDto` y `ProjectDto` con `@IsOptional @IsArray @IsString({ each: true }) @ArrayMaxSize(5)`. Actualizar `frontend/src/app/core/models/profile.ts` con `metrics: string[]`.
3. En `backend/src/cv-export/cv-export.service.ts`:
   - Render de skills: `name` sin nivel. Idiomas: `name (CEFR)`.
   - Bajo la descripción de experiencia/proyecto con `metrics` no vacías → bullets (`• <metric>`); omitir si vacío/ausente.
   - Fechas por item según `current` y `lang` (`Actualidad`/`Present`). Actualizar los tests existentes que esperaban `(n/5)`.
4. Frontend `/profile`: en los editores de experiencia y proyecto, agregar la lista editable de métricas (input + botón agregar + botón borrar por item). El guardado lleva `metrics` en el `PUT /profile`.
5. Frontend: crear `frontend/src/app/core/overlap-warning.ts` con `overlappingExperiences(experiences)` que devuelve los pares cuyo rango temporal se solapa (fechas no nulas; `current` extiende hasta hoy). En `profile.component`, mostrar un warning inline al lado de cada experiencia involucrada; no bloquea el guardado.
6. Verificación final: `npm run build:all`, `npm run lint:all`, `npm run test -w career-analyzer-backend`, y flujo manual (login → `/profile` con una experiencia freelance `current` y otra empleo solapada → ver el warning suave y guardar; exportar PDF/DOCX → skills sin nivel, idiomas con CEFR, métricas como bullets solo donde existen, fechas con `Actualidad`/`Present` según `lang`).

## Acceptance criteria

- [ ] El campo `metrics` existe en `Experience` y `Project`; la migración `experience_project_metrics` está aplicada y el client regenerado.
- [ ] `PUT /profile` acepta y persiste `metrics` (hasta 5 por item); `GET /profile` las devuelve; más de 5 → 400.
- [ ] En el PDF y el DOCX, los skills se renderizan como `name` (sin `(n/5)`) y los idiomas como `name (CEFR)`.
- [ ] Experiencias y proyectos con `metrics` no vacías muestran bullets; sin `metrics` no aparece sección de métricas; el texto extraído del PDF/DOCX (`pdf-parse`/`mammoth`) incluye las métricas solo si están en el perfil.
- [ ] `current: true` → `MM/YYYY — Actualidad` (es) y `MM/YYYY — Present` (en); fechas correctas por item en ambos idiomas.
- [ ] En `/profile`, dos experiencias con rango solapado muestran un warning inline; el guardado funciona igualmente.
- [ ] `npm run build:all` y `npm run lint:all` OK; `npm run test -w career-analyzer-backend` pasa (unit + e2e).

## Decisions

- **Sí:** omitir el nivel en los skills del CV generado, conservando el nivel en el perfil. El usuario confirmó que el nivel no aporta en el documento; los idiomas conservan CEFR por ser estándar.
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
| Duplicados visibles en el CV si el perfil está sucio | Se resuelven con la limpieza manual del spec de calidad de datos (SPEC 08); el generador no deduce. |

## What is **not** in this spec

- CV adaptado a una oferta (keywords, matching, tailoring).
- Múltiples templates o estilos seleccionables.
- Traducción del contenido del perfil (solo títulos, ya en SPEC 07).
- Generación o sugerencia de métricas por IA.
- Validación bloqueante de solapamientos.
- Dedupe de items en el generador (perfil se limpia en SPEC 08).

Cada uno, si llega, tendrá su propio spec.
