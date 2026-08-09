# SPEC 08 — Calidad de datos del perfil

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-08-08
> **Objective:** Garantizar la fidelidad del texto del Candidate Profile diagnosticando dónde se corrompe un CV importado (extracción vs parseo IA), normalizando ligaduras y caracteres tipográficos en la extracción, mejorando el prompt del parser, y permitiendo limpiar duplicados de skills y experiencias desde el editor del perfil.

## Scope

**In:**

- Backend: normalizador de texto aplicado justo después de la extracción (pdf-parse/mammoth) en el pipeline de importación de SPEC 06. Normaliza ligaduras unicode (U+FB00–U+FB06: `ﬁ`→`fi`, `ﬃ`→`ffi`, `ﬂ`→`fl`, etc.), comillas tipográficas → rectas, guiones en/em → guion simple, espacios no separables → espacio, y colapso de espacios múltiples.
- Mejora del prompt en `cv-parser.service.ts`: instruir explícitamente que ignore ligaduras/errores tipográficos residuales, que no duplique items idénticos o casi-idénticos, y que respete la grafía del CV (sin inventar).
- Script de diagnóstico `backend/scripts/diagnose-cv-text.ts`: dado un `documentId`, re-extrae el texto crudo del archivo, lo normaliza y lo compara contra el `draftJson` almacenado; imprime texto crudo, texto normalizado y los tokens del draft ausentes en el texto normalizado (señal de invención o error de parseo).
- Detección de duplicados en el frontend de `/profile` (SPEC 05): grupos por nombre normalizado (skills: lowercase, sin acentos, espacios colapsados) y por empresa+posición+periodo (experiencias). Badge de "duplicado" en el editor; el usuario borra o edita. Se persiste con el `PUT /profile` existente.
- Tests: unitarios del normalizador y del detector de duplicados, y e2e de importación con un fixture PDF que contenga ligaduras.

**Out of scope (para specs futuros):**

- Dedupe automático sin intervención humana (la IA no borra datos sin confirmación — invariante del README).
- Duplicados en educación, certificaciones, proyectos o idiomas (solo skills y experiencias).
- OCR para PDFs escaneados (SPEC 06 ya lo difirió).
- Corrección de typos que el usuario escribe manualmente en el perfil (no provienen del CV).
- Cambios en el render del CV generado (van en el spec del formato de CV generado).

## Data model

Este spec **no introduce estructuras de datos nuevas**: no hay tablas ni campos nuevos. Cambios de convención:

- `CvDocument.extractedText` pasa a guardar el texto **normalizado** (tras pasar por el normalizador), no el crudo tal cual sale de pdf-parse/mammoth. Sigue siendo la baseline auditable contra la cual verificar que la IA no inventó.
- El texto crudo pre-normalización no se persiste; el archivo original en `backend/uploads/` queda disponible para re-extraer (lo usa el script de diagnóstico).
- La detección de duplicados es una derivación client-side, sin campos ni endpoints nuevos.

## Implementation plan

Cada paso deja el sistema compilable y funcionando.

1. Crear `backend/src/cv-import/text-normalizer.ts` con `normalizeText(text: string): string`: mapa explícito de ligaduras (U+FB00–U+FB06), comillas tipográficas, guiones en/em, NBSP y colapso de espacios. Unit tests `text-normalizer.spec.ts` con fixtures de ligaduras (p. ej. `"ﬁle"` → `"file"`, `"eﬃcient"` → `"efficient"`). Aún no se conecta al pipeline.
2. Conectar el normalizador: en `text-extractor.service.extract()`, aplicar `normalizeText` al resultado de pdf-parse/mammoth antes del chequeo de umbral y antes de devolverlo. Actualizar el test existente del extractor. A partir de aquí `CvDocument.extractedText` guarda texto normalizado.
3. Mejorar el prompt en `cv-parser.service.ts`: añadir instrucciones de texto limpio, ignorar ligaduras residuales, no duplicar items idénticos/casi-idénticos y no inventar. Ajustar los tests del parser (OpenAI mockeado) para cubrir el nuevo prompt.
4. Crear `backend/scripts/diagnose-cv-text.ts`: lee `--documentId`, re-extrae el texto crudo del `storagePath`, lo normaliza con `normalizeText`, carga `draftJson` del `CvDocument`, y reporta: (a) texto crudo, (b) texto normalizado, (c) tokens de los campos del draft ausentes en el texto normalizado. Run manual: `node dist/scripts/diagnose-cv-text.js --documentId=<id>`.
5. Frontend: crear `frontend/src/app/core/duplicates.ts` con `findDuplicates(profile)` que devuelve los grupos duplicados (skills por nombre normalizado; experiencias por empresa+posición+periodo, ignorando mayúsculas/espacios). En `profile.component`, marcar los items duplicados con un badge en el editor y permitir borrarlos/editarlos (el guardado usa el `PUT /profile` existente).
6. Verificación final: `npm run build:all`, `npm run lint:all`, `npm run test -w career-analyzer-backend`, y flujo manual (importar un PDF con ligaduras → el perfil queda con texto limpio; correr `diagnose-cv-text` sobre un documento previo y confirmar la capa del problema; en `/profile` ver los badges de duplicados y limpiarlos).

## Acceptance criteria

- [ ] `normalizeText` convierte ligaduras (`ﬁ`→`fi`, `ﬃ`→`ffi`, `ﬂ`→`fl`), comillas tipográficas, guiones en/em y NBSP a su forma simple; los unit tests lo cubren.
- [ ] La extracción aplica el normalizador: importar un PDF cuyo texto crudo contiene ligaduras produce `CvDocument.extractedText` sin ligaduras.
- [ ] El prompt del parser instruye no duplicar ni inventar; el draft de un fixture con items repetidos no los duplica (verificable comparando contra `extractedText`).
- [ ] `diagnose-cv-text.ts` imprime texto crudo, texto normalizado y los tokens del draft ausentes en el texto normalizado para un `documentId` dado.
- [ ] En `/profile`, los skills duplicados (mismo nombre ignorando mayúsculas/acentos/espacios) y las experiencias duplicadas (misma empresa+posición+periodo) muestran un badge de duplicado; borrarlos se persiste con el `PUT` existente.
- [ ] `npm run build:all` y `npm run lint:all` OK; `npm run test -w career-analyzer-backend` pasa (unit + e2e).
- [ ] Flujo manual: importar CV con ligaduras → perfil limpio; el diagnóstico confirma la capa de corrupción; los duplicados se limpian desde `/profile`.

## Decisions

- **Sí:** normalizar en la extracción en lugar de solo en el prompt. Ataca la raíz del problema: la IA recibe texto limpio y el guardado es auditable.
- **Sí:** `extractedText` guarda el texto normalizado. Sigue siendo la baseline para verificar que la IA no inventó (SPEC 06).
- **Sí:** script de diagnóstico. El usuario no sabía si el texto "mal escrito" venía de la extracción o del parseo; el script responde esa pregunta comparando crudo vs normalizado vs draft.
- **Sí:** detección de duplicados en el frontend (client-side, derivada). Es presentación pura; no justifica endpoints ni campos.
- **Sí:** acción manual, no auto-dedupe. Coherente con el invariante de que la IA no modifica datos sin confirmación humana.
- **Sí:** duplicados solo en skills y experiencias (los casos reportados). Otras colecciones quedan fuera.
- **No:** auto-dedupe, otras colecciones, OCR, corrección de typos manuales, cambios en el render del CV — cada uno a su spec.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| PDF con ligaduras fuera del mapa U+FB00–U+FB06 | El normalizador usa un mapa explícito y el prompt del parser instruye ignorar caracteres raros residuales. |
| La normalización cambia la baseline de `extractedText` vs SPEC 06 | El archivo original queda en `backend/uploads/` para re-extraer; el diagnóstico lo usa para comparar crudo vs normalizado. |
| Duplicados con diferencias sutiles (`"Full-stack"` vs `"Full Stack"`) | Normalización por nombre (lowercase, sin acentos, espacios colapsados) reduce falsos negativos; el badge solo sugiere, el usuario decide. |
| El prompt nuevo del parser degrada la calidad | Los tests del parser (OpenAI mockeado) validan el contrato; el gate humano de confirmación absorbe imperfecciones (SPEC 06). |

## What is **not** in this spec

- Dedupe automático sin confirmación humana.
- Duplicados en educación, certificaciones, proyectos o idiomas.
- OCR para PDFs escaneados.
- Corrección de typos escritos manualmente por el usuario.
- Cambios en el render del CV generado (spec propio).

Cada uno, si llega, tendrá su propio spec.
