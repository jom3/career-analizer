# SPEC 20 — El CV adaptado respeta el nivel declarado de cada skill

> **Status:** Approved
> **Depends on:** SPEC 05 (niveles de skill 1–5), SPEC 12 (CV adaptado), SPEC 18 (idioma de generación es/en)
> **Date:** 2026-08-29
> **Objective:** Que el CV adaptado a una oferta (SPEC 12) respete el nivel 1–5 que el candidato declaró para cada skill en su perfil: el resumen se redacta con prosa natural sobre **hechos reales** (skills solo de nivel ≥ 4, nunca nivel bajo ni "aprendizaje"), y la IA no afirma dominio/expertise por encima del nivel declarado al reescribir las descripciones, sin mostrar el número en el documento.

## Scope

**In:**

- **Tabla de niveles compartida** (`backend/src/cv-adaptation/skill-level.ts`): única fuente de verdad para la escala y los términos prohibidos, usada por la selección de hechos del resumen y por el texto del prompt de la IA (DRY):
  - `LOW_SKILL_MAX = 3` (nivel "bajo" = 1–3), `HIGH_SKILL_MIN = 4`.
  - `qualifierForLevel(level, lang)` → calificativo para niveles 1–3 en es/en (1 = `familiaridad con` / `familiarity with`, 2 = `conocimientos básicos de` / `basic knowledge of`, 3 = `conocimientos intermedios de` / `intermediate knowledge of`; `null` para ≥4). Se conserva como tabla de referencia para el prompt de descripciones.
  - `FORBIDDEN_EXPERTISE_TERMS`: términos de dominio/expertise (es/en) que la IA no debe usar sobre skills de nivel bajo (expert, mastery, advanced, deep, senior, "dominio de", "especialista en", "amplia experiencia en", etc.).
- **Resumen redactado por IA sobre hechos reales**: `buildSummaryFacts` (`backend/src/cv-adaptation/cv-adaptation-summary.ts`) selecciona determinísticamente QUÉ puede afirmarse y la IA lo escribe en prosa natural (estructura del usuario: rol + años → modalidad laboral → proyecto/logro con propósito → 2-3 skills integradas en una acción → cualidad transferible con evidencia; 3-4 oraciones, ~60-80 palabras, sin primera persona, sin "aprendizaje", sin calificativos de nivel, sin oración separada sobre el área de las skills). El fact sheet incluye:
  - `role` (headline o cargo real más reciente) y `years` (solo con fechas reales).
  - `workType` derivado de la empresa actual (freelance/independiente → `freelance`; empresa real → `salaried`; sin experiencia → `null`).
  - `featuredProject` (el más relevante a la oferta por techStack/descripción que citan skills matcheadas; propósito = descripción real, resultados = metrics reales).
  - `featuredSkills` (las usadas en el proyecto destacado —stack real— primero, luego las de nivel ≥ 4 matcheadas, máx 3; el nivel se resuelve por **lookup de nombre normalizado**, case-insensitive, trim).
  - `quality` (adaptable-stacks con stacks variados; maintainable-code con mención real; performance con métricas; `null` sin evidencia).
  - Los niveles bajos (≤3), las skills missing de la oferta, la línea de compromiso y los idiomas **no entran** en el resumen: las skills de nivel bajo viven en la sección de skills del CV.
- **Prompt y schema de la IA** (`backend/src/cv-adaptation/cv-adaptation-parser.service.ts`): el schema ahora exige `summary` además de `experienceDescriptions`; el prompt recibe el fact sheet y pide el párrafo con la estructura del usuario, sin primera persona, sin "learning", sin calificativos, usando solo los hechos. Se mantiene la restricción de nivel para las descripciones:
  - Para skills de nivel ≤ 3 está **prohibido afirmar dominio/expertise** (`FORBIDDEN_EXPERTISE_TERMS`).
  - El skill se menciona describiendo trabajo real con verbos neutros ("trabajé con", "usé" / "worked with", "used"), sin exageración.
  - Un skill de nivel 1–2 no se presenta como fortaleza central ni como competencia distintiva.
- **Guarda determinista del resumen** (server-side): el summary se descarta (fallback al summary del perfil) si afirma una skill missing de la oferta o promete aprender algo ("learn/aprend"). No rompe la generación.
- **Tests**: unitarios de `skill-level.spec.ts` (tabla por nivel e idioma), de `cv-adaptation-summary.spec.ts` (fact sheet: rol, años, modalidad, proyecto, skills ≥ 4, cualidad, es/en), de `cv-adaptation-parser.service.spec.ts` (el prompt incluye la estructura del resumen + restricción de niveles; el summary se normaliza; la guarda descarta summary con missing skills o "learning"), de `cv-adaptation.service.spec.ts` (summary del parser persistido; fallback al summary del perfil), y e2e (adaptar un CV con un skill de nivel 2 que la oferta pide → el skill NO aparece en el summary; el prompt se verifica en unit test; el flujo manual valida el texto real).
- **Contrato del service**: `cv-adaptation.service.ts` persiste `result.summary` (redactado por IA y validado) o el summary del perfil como fallback; `matchedSkills` sigue siendo `string[]`; el snapshot ya lleva niveles.

**Out of scope (para specs futuros):**

- El CV base exportado (SPEC 07/09): **no cambia** — solo renderiza el resumen y las skills que el usuario escribió, sin afirmaciones generadas por el sistema.
- La carta de motivación (SPEC 13).
- Mostrar el nivel en el documento (número o palabra): sigue oculto, coherente con SPEC 09.
- Guardia determinista server-side que detecte adjetivos de experto (solo prompt).
- Cambiar las reglas de ordenamiento/priorización de skills por nivel (el orden sigue siendo por relevancia a la oferta).
- Migrar/re-generar automáticamente CVs adaptados existentes: se mantienen; se regenera para aplicar (patrón SPEC 18).
- Más de dos idiomas.

## Data model

**No hay cambios en `schema.prisma` ni migraciones.** El snapshot del perfil (`AdaptedProfileSnapshot.skills`) ya incluye `level` y se persiste en `profileSnapshot` (SPEC 12). Única estructura nueva: el helper `backend/src/cv-adaptation/skill-level.ts` (constantes de nivel/idioma, no persistida).

## Implementation plan

Cada paso deja el sistema compilable y funcionando.

1. **Helper de niveles**: crear `backend/src/cv-adaptation/skill-level.ts` con `LOW_SKILL_MAX`, `HIGH_SKILL_MIN`, `qualifierForLevel(level, lang)` y `FORBIDDEN_EXPERTISE_TERMS`. Unit tests `skill-level.spec.ts` (calificativos 1–3 es/en, `null` para 4–5, términos presentes en ambos idiomas). Aún no se conecta.
2. **Fact sheet determinista**: en `cv-adaptation-summary.ts`, reemplazar el resumen de texto por `buildSummaryFacts` que devuelve rol/años/modalidad/proyecto destacado/skills (del proyecto primero, luego nivel ≥ 4)/cualidad con evidencia. La selección de skills usa lookup por nombre normalizado y `HIGH_SKILL_MIN`. Actualizar `cv-adaptation-summary.spec.ts` con los casos del fact sheet.
3. **Prompt y schema de la IA**: en `cv-adaptation-parser.service.ts`, agregar `summary` al schema y al `AdaptationResult`, recibir `summaryFacts` en el input, instruir la estructura del usuario (sin primera persona, sin learning, sin calificativos) y agregar la guarda determinista (descarta summary con missing skills o "learning"). Actualizar `cv-adaptation-parser.service.spec.ts`.
4. **Service**: en `cv-adaptation.service.ts`, conectar `buildSummaryFacts` y persistir `result.summary ?? profile.summary`. Actualizar `cv-adaptation.service.spec.ts` y el e2e.
5. **Verificación final**: `npm run build:all`, `npm run lint:all`, `npm run test -w career-analyzer-backend`, y flujo manual (login → `/profile` con React en nivel 2 y Angular en nivel 4 → `/job-analysis` → analizar y guardar una oferta que pida React → "Adaptar CV" → el resumen es un párrafo natural que NO menciona React (nivel bajo) y las descripciones no usan términos de experto para React; regenerar el mismo CV con un perfil donde React sea nivel 5 → aparece integrado en una acción).

## Acceptance criteria

- [ ] `skill-level.ts` define `LOW_SKILL_MAX = 3`, `HIGH_SKILL_MIN = 4`, `qualifierForLevel` (1 = familiaridad/familiarity, 2 = básico/basic, 3 = intermedio/intermediate; `null` para ≥4) y `FORBIDDEN_EXPERTISE_TERMS` es/en; los unit tests lo cubren.
- [ ] Con una oferta que pide React (nivel 2 en el perfil) y Angular (nivel 4), el `content.summary` del adaptado es un párrafo redactado por la IA sobre el fact sheet: menciona Angular (nivel ≥ 4) integrado en una acción y **no** menciona React ni calificativos de nivel ("conocimientos básicos de X") ni "compromiso/aprendizaje".
- [ ] `buildSummaryFacts` selecciona rol, antigüedad solo con fechas reales, modalidad laboral, proyecto destacado con propósito, y skills en este orden: usadas en el proyecto destacado primero y luego de nivel ≥ 4 matcheadas (máx 3, lookup por nombre normalizado); la cualidad transferible solo aparece con evidencia real.
- [ ] El `buildSystemPrompt` incluye la estructura del resumen del usuario (60-80 palabras, 3-4 oraciones, sin primera persona, sin "learning", sin calificativos, propósito del proyecto en máximo 8-10 palabras, sin oración separada sobre cómo aplica las skills) y la restricción de niveles para descripciones (prohibido dominio/expertise para ≤ 3, verbos de trabajo real, skills 1–2 no como fortaleza central).
- [ ] La guarda determinista descarta el summary que afirma una skill missing de la oferta o que promete aprender; ante fallo el service cae al summary del perfil (nunca rompe).
- [ ] No hay cambios en `schema.prisma` ni migraciones nuevas; el nivel no aparece como número ni palabra en el documento exportado.
- [ ] Los CVs adaptados ya generados se mantienen sin cambios; regenerar aplica la nueva conducta (sin migración automática).
- [ ] `npm run build:all`, `npm run lint:all` y `npm run test -w career-analyzer-backend` pasan (unit + e2e); el flujo manual verifica resumen natural sin skills de nivel bajo.

## Decisions

- **Sí:** el fix vive **solo en el CV adaptado** (SPEC 12). El CV base (SPEC 07/09) renderiza el resumen y las skills tal cual las escribió el usuario (no hay afirmaciones del sistema) y la carta (SPEC 13) queda fuera: el problema reportado es la adaptación para postularse.
- **Sí:** **no mostrar el nivel** (número o palabra) en el documento, coherente con SPEC 09; solo se matiza el lenguaje para no exagerar.
- **Sí:** **tabla de niveles**: 1 = familiaridad, 2 = básico, 3 = intermedio, 4 = avanzado, 5 = experto/dominio; "bajo" = ≤ 3. Confirmada por el usuario.
- **Sí (ajuste de sesión): el resumen lo redacta la IA pero SOLO sobre hechos que el sistema selecciona de datos reales** (`buildSummaryFacts`). Se revierte parcialmente la decisión de SPEC 12 ("resumen determinista") porque el usuario pidió prosa natural (el ejemplo dado: "Desarrolló una plataforma... aplicando Docker y Prisma para optimizar el flujo de trabajo"), pero se preserva la invariante de no-inventar: el fact sheet restringe qué se puede afirmar y la guarda server-side descarta summary que afirmen skills missing o "aprendizaje".
- **Sí (ajuste de sesión): las skills de nivel bajo (≤3) NO van en el resumen** — van en la sección de skills del CV. Solo las de nivel ≥ 4 (avanzado/experto) se integran en una acción. La línea de compromiso ("Compromiso con el aprendizaje de X") y los idiomas se eliminan del resumen: "en un resumen no va quién soy ni lo que voy a hacer".
- **Sí:** la **modalidad laboral** se deriva de la empresa real actual (freelance/independiente → freelance; empresa real → salarial) y la **cualidad transferible** se elige solo con evidencia real (stacks variados, mención de mantenibilidad, métricas); sin evidencia se omite.
- **Sí:** **control por prompt**: la IA ya recibe el nivel en el snapshot y se le prohíbe afirmar dominio por encima del nivel declarado en las descripciones. Sin guardia determinista server-side de adjetivos: coherente con la división de responsabilidades de SPEC 12; si aparece un caso real de exageración, se sube a guardia en un spec futuro.
- **Sí:** **helper compartido `skill-level.ts`** como única fuente de la escala, calificativos y términos prohibidos, usado por la selección de hechos y el texto del prompt (DRY).
- **Sí:** los documentos ya generados **no se migran**; se regeneran para aplicar (consistente con SPEC 18).
- **No:** tocar el ordenamiento/priorización de skills por nivel, mostrar el nivel en el documento, guardia server-side de adjetivos, aplicar a carta o CV base, migrar documentos existentes.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| La IA ignora la restricción del prompt y exagera igualmente | El prompt prohíbe explícitamente los términos (`FORBIDDEN_EXPERTISE_TERMS`) y el unit test verifica que viajan en el prompt; el fact sheet restringe las skills del resumen a nivel ≥ 4; si aparece un caso real, se eleva a guardia determinista en un spec futuro. |
| La IA inventa hechos en el resumen a pesar del fact sheet | La guarda server-side descarta el summary si afirma skills missing o promete aprendizaje; el fact sheet se persiste en `profileSnapshot` para auditoría. |
| La cualidad transferible suena genérica sin evidencia | Solo se incluye con evidencia real (stacks variados, menciones de mantenibilidad, métricas); sin evidencia se omite. |
| El resumen queda corto o incompleto si faltan datos (años, proyecto, skills altas) | Cada parte es opcional: la IA omite lo que no tiene fact; el prompt lo permite explícitamente. |
| El skill no se encuentra en el snapshot por casing/whitespace | Lookup por nombre normalizado; ante fallo se excluye de `featuredSkills` (nunca rompe la generación). |
| El nivel declarado por el usuario no refleja la realidad | El sistema respeta el dato del perfil (fuente de verdad, invariante del README); no lo corrige ni lo interpreta. |

## What is **not** in this spec

- Cambios en el CV base exportado (SPEC 07/09).
- Cambios en la carta de motivación (SPEC 13).
- Mostrar el nivel de skill en el documento.
- Guardia determinista server-side contra adjetivos de experto.
- Reordenamiento o repriorización de skills por nivel.
- Migrar/re-generar automáticamente CVs adaptados existentes.
- Más de dos idiomas.

Cada uno, si llega, tendrá su propio spec.