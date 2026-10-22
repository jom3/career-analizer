# SPEC 20 — Match reproducible y explicable

> **Status:** Approved
> **Depends on:** SPEC 10 (análisis de oferta), SPEC 11 (job matching)
> **Date:** 2026-10-22
> **Objective:** Que el score de encaje sea reproducible (misma entrada, mismo resultado), explicable (el usuario ve cómo se calculó) y menos dependiente de la interpretación del modelo, combinando una cobertura calculada en código con la evaluación de la IA.
> **Orden de implementación:** 2.º (después de SPEC 22).

## Scope

**In:**

- **Cobertura determinista de requisitos.** Porcentaje de `requiredSkills` de la oferta que el perfil evidencia, calculado en código.
- **Score global ponderado 50/50:** `overallScore = round(0.5 × cobertura + 0.5 × scoreIA)`.
- **Reproducibilidad:** `temperature: 0` en las llamadas de match y de análisis de oferta.
- **Rúbrica con anclas** en el prompt de match: significado concreto de cada rango de score.
- **Coherencia de gaps:** un skill con evidencia determinista nunca puede quedar como `MISSING`; un `HAVE` sin evidencia determinista se degrada a `PARTIAL`.
- **Desglose visible** en el detalle del match: cobertura, score de IA y fórmula.
- **Detección de idioma de la oferta** a cargo de la IA, con la heurística actual como respaldo.
- **Versionado del cálculo:** `scoringVersion` en `JobMatch`. Los matches calculados con la versión anterior se marcan como "recalcular".
- **Set de evaluación manual** con los datos de `backend/test/fixtures/evals/`.

**Out:**

- Cambiar las 4 dimensiones (`skills`, `experience`, `education`, `languages`).
- Matching por embeddings o por proveedor distinto de OpenAI.
- Pesos configurables por usuario.

## Decisions

- **Sí:** **ponderación 50/50** entre cobertura determinista y score de IA. Es el punto de partida acordado; se puede ajustar con el set de evaluación.
- **Sí:** **la cobertura solo cuenta evidencia explícita**: skills del perfil y `techStack` de proyectos. Las menciones en texto libre (descripciones, métricas) no cuentan para la cobertura, aunque sí pueden sustentar la evaluación de la IA.
- **Sí:** **alias acotados** en una tabla fija: `Node`↔`Node.js`, `Postgres`↔`PostgreSQL`, `JS`↔`JavaScript`, `TS`↔`TypeScript`, `k8s`↔`Kubernetes`. Comparación sin distinguir mayúsculas ni espacios extremos.
- **Sí:** **sin requisitos declarados** (`requiredSkills` vacío): la cobertura es `null` y el score global es el de la IA. Se indica en el desglose.
- **Sí:** **`temperature: 0`** en match y análisis de oferta. No aplica a la redacción de cartas ni de CV (SPEC 21).
- **No:** cambiar el modelo por defecto. Sigue `gpt-4o-mini` salvo `OPENAI_MODEL`.

## Data model

Cambios en `JobMatch` (migración `match_scoring_version`):

```prisma
model JobMatch {
  // ...columnas existentes...
  coverage        Int?     // 0-100; null si la oferta no declara requiredSkills
  aiScore         Int      // score devuelto por la IA (0-100)
  scoringVersion  Int      @default(1)
}
```

- Matches existentes: `scoringVersion = 1`, `coverage = null`, `aiScore = overallScore`.
- Matches nuevos: `scoringVersion = 2`.
- `overallScore` sigue siendo el valor visible y el que usa la lista.

Cambios en la respuesta de `JobMatchDto` (aditivos):

```ts
interface JobMatchDto {
  // ...campos existentes...
  coverage: { matched: string[]; total: number; percent: number | null } | null;
  aiScore: number;
  scoringVersion: number;
  needsRecalculation: boolean; // scoringVersion < versión actual
}
```

## Implementation plan

Cada paso deja el sistema compilable.

1. **Cobertura determinista:** crear `backend/src/job-match/coverage.ts` con `computeCoverage(requiredSkills, profileSnapshot)`. Normaliza nombres, aplica la tabla de alias y devuelve `matched`, `total` y `percent`. Función pura, sin dependencias de Nest.
2. **Ponderación:** `overallScore = coverage === null ? aiScore : Math.round(0.5 * coverage.percent + 0.5 * aiScore)`. Función pura en `coverage.ts`.
3. **Coherencia de gaps:** después de la whitelist actual, aplicar: si el skill está en `coverage.matched` → `HAVE`; si la IA dice `HAVE` sin evidencia determinista → `PARTIAL` con nota "evidencia parcial". Un `MISSING` de la IA con evidencia determinista se corrige a `HAVE`.
4. **Parser de match:** `temperature: 0`; rúbrica con anclas en `buildSystemPrompt`:
   - 0–20: sin evidencia.
   - 21–40: evidencia indirecta o muy débil.
   - 41–60: evidencia parcial.
   - 61–80: evidencia sólida pero incompleta.
   - 81–100: evidencia directa y cuantificada en la mayoría de los requisitos.
5. **Parser de oferta:** `temperature: 0`; el schema incluye `sourceLanguage` (`es` | `en` | `other`). `detectLanguage` queda como respaldo si la respuesta no trae idioma.
6. **Service:** `computeAndPersist` calcula cobertura, aplica la fórmula, guarda `coverage`, `aiScore` y `scoringVersion = 2`.
7. **Migración** `match_scoring_version` y `prisma:generate`.
8. **Frontend — detalle del match:** bloque "Cómo se calculó": cobertura (`X de Y requisitos, Z%`), score de IA y fórmula. Si la cobertura es `null`, mostrar "La oferta no declara requisitos: el score es el de la evaluación IA".
9. **Frontend — recalcular:** si `needsRecalculation`, banner con botón "Recalcular" (reutiliza `recompute`).
10. **Tests:** ver sección de tests.
11. **Set de evaluación:** script manual `npm run test:eval` (archivo `backend/test/match.eval.ts`, fuera de la suite normal) que corre `cases.json` contra OpenAI real.

## Tests

**Unitarios (`coverage.spec.ts`, obligatorios):**

- Los 10 casos de `cases.json`: la cobertura calculada coincide exactamente con `expect.coverage` y `expect.requiredMatched`.
- Alias: `Node` en la oferta matchea `Node.js` en el perfil (caso `c06`).
- Evidencia solo en `techStack` de proyectos cuenta (caso `c04`, `scikit-learn`).
- Texto libre no cuenta: una skill mencionada solo en una descripción queda como `MISSING` en cobertura.
- `requiredSkills` vacío → `coverage: null` y `overallScore === aiScore`.
- Fórmula: con cobertura 67 y aiScore 70 → `round(0.5·67 + 0.5·70) = 69`.
- Coherencia de gaps: IA dice `MISSING` con evidencia determinista → `HAVE`; IA dice `HAVE` sin evidencia → `PARTIAL`.

**Unitarios del parser:** `temperature === 0` en la llamada a OpenAI (mock de `chat.completions.create`).

**Evaluación manual (no bloquea CI):** para cada caso, `coverage` exacta y `aiScore` dentro de `aiScoreRange` en al menos 8 de 10 casos. Repetir 3 veces el caso `c01`: scores dentro de ±3 puntos.

## Acceptance criteria

- [ ] `coverage.ts` implementado como funciones puras, con tests que cubren los 10 casos de `cases.json`.
- [ ] El score global se calcula con la fórmula 50/50 y se guarda `aiScore`, `coverage` y `scoringVersion = 2`.
- [ ] Un skill con evidencia determinista nunca aparece como `MISSING`.
- [ ] Un `HAVE` de la IA sin evidencia determinista se muestra como `PARTIAL`.
- [ ] Las llamadas de match y de análisis de oferta usan `temperature: 0`.
- [ ] El detalle del match muestra cobertura, score de IA y fórmula.
- [ ] Matches con `scoringVersion < 2` muestran banner de recalcular.
- [ ] El set de evaluación manual cumple el umbral (8 de 10 casos en rango y estabilidad ±3).
- [ ] `npm run build:all`, `npm run lint:all` y `npm run test:all` pasan.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| La cobertura penaliza perfiles que sí tienen la skill, pero no la declaran explícitamente | Evidencia solo desde skills y proyectos; el usuario ve qué skills contaron en el desglose. Se puede ampliar la tabla de alias. |
| Matches viejos y nuevos no son comparables | `scoringVersion` y banner de recalcular. |
| `temperature: 0` no garantiza determinismo total | El set de evaluación mide la estabilidad (±3); el objetivo es reducir la variación, no eliminarla. |
| Subir la cobertura a 50% sube falsos positivos de alias | Tabla de alias corta y explícita; cualquier alias nuevo requiere caso en `cases.json`. |

## What is **not** in this spec

- Matching por embeddings.
- Pesos configurables.
- Nuevas dimensiones de score.
- Cambios en la redacción de cartas o CV (SPEC 21).
