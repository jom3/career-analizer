# SPEC 26 — Gerundios en textos generados

> **Status:** Approved
> **Depends on:** SPEC 21 (cartas, prompt v3), SPEC 22 (idioma del documento)
> **Date:** 2026-10-23
> **Objective:** Reducir los gerundios en las descripciones adaptadas del CV y en las cartas de presentación. Un gerundio encadenado («usé X, logrando Y») suena a traducción literal del inglés y resta naturalidad. El cambio se decide con medición antes y después, no por intuición.

## Scope

**In:**

- Medir la frecuencia de gerundios en las descripciones que devuelve `CvAdaptationParserService` y en las cartas que devuelve `CoverLetterParserService`, con el banco de `backend/test/fixtures/evals/`.
- Agregar al prompt de adaptación de CV la misma regla que ya tiene la carta v3: verbos conjugados, sin gerundios.
- Repetir la medición y comparar.
- Documentar el detector y sus casos de falsos positivos.

**Out:**

- Validador determinista que bloquee o reescriba textos. Solo se evalúa si la medición post-cambio muestra que el prompt no alcanza.
- Gerundios del perfil original del usuario: el perfil es fuente de verdad y no se reescribe.
- Plantillas del resumen del CV (son deterministas; se revisan a mano en la tarea de medición).

## Decisions

- **Sí:** **medir antes de cambiar.** La línea base se toma con el prompt actual de CV y el de carta v3.
- **Sí:** **el detector es una heurística de sufijos** (`-ando`, `-iendo`, `-yendo`, con pronombres enclíticos) con una lista corta de excepciones (`cuando`, `mando`, `comando`, `demando`, nombres propios como `Fernando`). Sirve para medir tendencias, no para bloquear.
- **Sí:** **las muestras de CV usan la temperatura por defecto del servicio** (no 0), para reflejar la variación real. Las cartas usan temperatura 0, como en producción.
- **No:** cambiar el resultado de negocio (qué experiencias se muestran, qué skills se afirman). Solo cambia la redacción.

## Medición

Script: `backend/test/gerund.eval.ts`, comando `npm run test:gerund-eval -w career-analyzer-backend`. Variables: `EVAL_LABEL` (nombre de la corrida), `EVAL_REPS` (repeticiones por caso de CV, default 3). Salidas en `backend/test/gerund-eval-out/` (gitignored) y un `<label>-summary.json`.

Casos: los mismos pares perfil-oferta del banco de cartas (P1/P3/P4 con O1/O4). Métrica: textos con al menos un gerundio y cantidad total de gerundios, por tipo de documento.

## Resultados de la medición

Modelo `gpt-4o-mini`. CV: 6 pares × 3 repeticiones = 18 textos. Cartas: 6 pares = 6 textos.

| Corrida | Prompt de CV | Prompt de carta | CV: textos con gerundios / gerundios | Cartas: textos con gerundios |
| --- | --- | --- | --- | --- |
| `baseline` | v1 (sin regla) | v3 | 12 / 24 | 5 / 6 |
| `after` | regla de gerundios | v4 (regla + ejemplo) | 11 / 18 | 4 / 6 |
| `after2` | regla + «no copiar de la oferta» | v4 | 11 / 12 | 3 / 6 |
| `after3` | regla de frases que empiezan con verbo en pasado | v4 | 8 / 8 | 6 / 6 |
| `after4` | igual que `after3` en CV | regla simple, sin ejemplo | 6 / 7 | 5 / 6 |

**Pruebas adicionales sobre cartas:**

| Corrida | Qué se probó | Resultado |
| --- | --- | --- |
| `rewrite` | paso de reescritura (segunda llamada que edita solo las frases con gerundios), con `gpt-4o-mini` | Sobre 4 cartas con gerundios, 3 siguen con gerundios. Además agregó una afirmación nueva («No cuento con experiencia directa en Python…») y un adjetivo prohibido («sólido conocimiento»). Descartado. |
| `gpt4o` | misma carta v3 con `gpt-4o` | 5 de 6 cartas siguen con gerundios. Un modelo más grande no resuelve el problema. |

**Decisión:**

- **CV: se adopta** la regla en español (`cv-adaptation-parser.service.ts`): frases que empiezan con verbo conjugado en pasado y sin gerundios. Reduce de 12 a 6 textos con gerundios y de 24 a 7 gerundios. Es el estilo habitual de bullets de CV.
- **Cartas: no se adopta cambio de prompt.** Ninguna variante bajó de forma sostenida. La regla «frases que empiezan con verbo» volvió la carta una lista repetitiva, y la regla simple no movió el número. El prompt v3 queda como estaba.
- **Lección:** los ejemplos negativos con gerundios (BAD) inducen el mismo gerundio que se quiere evitar. Solo se usan ejemplos positivos.
- **Paso de reescritura para cartas: descartado.** No elimina los gerundios de forma confiable y introduce contenido nuevo, lo que viola el invariante de no inventar.
- **Cambio de modelo para cartas: descartado como solución.** gpt-4o tampoco elimina los gerundios.
- **Pendiente posible:** cambiar la estructura del prompt de carta (por ejemplo, pedir primero las frases en forma de hechos y luego la prosa) o aceptar gerundios ocasionales en cartas. Requiere una nueva spec y su propia medición.

## Acceptance criteria

- [x] Existe una línea base registrada (`baseline`) para CV y cartas.
- [x] CV: la corrida final reduce los textos con gerundios (12 → 6 de 18).
- [x] Cartas: no empeoran respecto de la línea base; el prompt v3 se conserva.
- [x] `npm run test -w career-analyzer-backend` de CV y carta pasan.
- [x] `npm run lint:all` y `npm run build:all` pasan.
- [ ] Decisión pendiente sobre el paso de reescritura para cartas.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Muestras chicas dan resultados ruidosos | Repetir cada caso de CV (`EVAL_REPS`) y reportar cantidades, no solo porcentajes. |
| Falsos positivos del detector | Lista de excepciones y revisión manual de los ejemplos listados en el resumen. |
| Costo de tokens | Corridas acotadas: 6 pares, 3 repeticiones para CV, 1 para cartas. |
| El prompt empeora la fidelidad | El test de fidelidad de `cv-adaptation.service.spec.ts` y las advertencias de carta se revisan en cada corrida. |
