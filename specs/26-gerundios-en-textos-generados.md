# SPEC 26 — Gerundios en textos generados

> **Status:** Implemented
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

**Segunda etapa: cartas con el pipeline completo.** La medición anterior miraba solo el borrador. Ahora `gerund.eval.ts` llama a `CoverLetterParserService.generate` (borrador, validación y corrección), que es lo que ve el usuario.

| Corrida | Cambio | Cartas con gerundios (6) | Gerundios |
| --- | --- | --- | --- |
| `pipeline-before` | ninguno (solo el pipeline actual) | 4 | 5 |
| `pipeline-after` | advertencia `GERUND` en el validador, que dispara la corrección existente | 1 | 1 |

**Cambio aplicado:** `GERUND` es una advertencia más del validador de cartas en español (`letter-validators.ts`). La corrección existente recibe la instrucción de reemplazarlos por verbos conjugados sin agregar hechos. Detector en `spanish-gerunds.ts`, compartido por el validador y la medición. Se excluyen verbos de primera persona como «entiendo», que la primera versión marcaba como falsos positivos.

**Hallazgos a revisar a mano en `pipeline-after`:**

- La corrección puede redactar negaciones sobre skills de la oferta que el perfil no tiene (P4-O4: «No cuento con experiencia en Python…»). Es honesto, pero ocupa la carta. Hay que decidir si se acepta.
- P1-O1 dice «en una empresa del sector tecnológico», que no está en el perfil. Viene del borrador (regla de describir empleadores por sector), no de la corrección. Sin verificación automática de hechos no lo podemos asegurar.
- P1-O4 conserva un gerundio: la corrección es de una sola pasada.

**Tercera etapa: skills faltantes, fidelidad y gerundio residual.**

| Corrida | Cambio | Cartas con gerundios | Cartas con skill faltante mencionada | Cartas con afirmación sin respaldo (juez) |
| --- | --- | --- | --- | --- |
| `fidelity` | advertencia `MISSING_SKILL` en el validador (pero sin limpieza posterior) | 2 | 1 | 6 (juez gpt-4o-mini, poco confiable) |
| `final` | limpieza determinista de oraciones con skills faltantes + juez gpt-4o | 0 | 0 | 2 de 6 (4 afirmaciones) |

**Cambios aplicados:**

- `MISSING_SKILL`: la carta no puede mencionar tecnologías de la oferta que el perfil no tiene, ni siquiera para negarlas. Criterio de palabra completa compartido con CV, movido a `backend/src/common/token-mention.ts`.
- Red de seguridad: si la corrección deja una mención a una skill faltante, se quita la oración completa. No agrega hechos. Test en `cover-letter-parser.service.spec.ts`.
- Juez de fidelidad solo en la medición (`EVAL_JUDGE_MODEL`, por defecto gpt-4o). No está en producción.
- Gerundio residual: resuelto en la práctica (0 de 6). El límite de dos llamadas (borrador y una corrección) es una decisión deliberada y está cubierto por un test, así que no se agregó una segunda pasada.

**Lo que sigue abierto (revisión humana):**

- P1-O1 y P1-O4: el juez marca «Más de 4 años de experiencia…». La oferta pide «4+ años», pero el perfil no tiene fechas que lo respalden. La carta toma un requisito de la oferta como experiencia del candidato. Hay que decidir si es una regla nueva (años solo si el perfil los prueba) o se acepta.
- P1-O4: «Utilicé bases de datos en varios proyectos» y «He trabajado para desarrollar aplicaciones backend»: el juez los marca como no respaldados, pero pueden ser parafraseos de la descripción del perfil. Requiere lectura humana.
- Sector de empleador inventado («empresa del sector tecnológico») y niveles de skill citados como texto: pendiente de regla en el prompt.
- El juez es un modelo de IA. No reemplaza una revisión humana.

**Cuarta etapa: años de experiencia y sector del empleador.**

| Corrida | Cambio | Cartas con gerundios | Skills faltantes mencionadas | Afirmaciones sin respaldo (juez) |
| --- | --- | --- | --- | --- |
| `final` | (etapa anterior) | 0 | 0 | 2 de 6 (4 afirmaciones; incluía años y sector) |
| `fidelity2` | `UNSUPPORTED_YEARS` y `UNSUPPORTED_SECTOR` contra el texto del perfil, red de seguridad extendida, prompt v4 | 0 | 0 | 2 de 6 (4 afirmaciones; ninguna es un año ni un sector) |

**Cambios aplicados:**

- **Años de experiencia:** una cifra con «años» o «years» en una oración de experiencia solo es válida si el perfil la declara junto a una unidad de tiempo. La oferta no cuenta como evidencia del candidato. Un nivel de skill numérico (`level: 4`) tampoco.
- **Sector:** mencionar un sector o industria solo es válido si el perfil lo menciona. El prompt ya no obliga a describir empleadores por sector: solo si el perfil lo declara; si no, se omite el empleador.
- **Red de seguridad:** después de la corrección, las oraciones con skills faltantes, años o sectores sin respaldo se quitan completas. No agrega texto.
- **Versión del prompt de carta:** 4.

**Costo conocido:** en P4-O4 la carta quedó muy corta (dos oraciones útiles). Quitar lo no respaldado deja poco material cuando el perfil es escaso. Es preferible a inventar, pero conviene revisar si el candidato necesita completar su perfil.

**Hallazgos del juez que siguen abiertos:** «Tengo experiencia en APIs en producción» (P4-O1) y «Tengo experiencia en la construcción de APIs en producción» (P3-O1) aparecen sin respaldo explícito. No son años ni sectores, y el juez puede ser estricto con parafraseos. Requiere lectura humana.

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
- [x] Cartas: el pipeline completo baja de 4 a 1 de 6 cartas con gerundios (`pipeline-after`).
- [x] Tests del detector y del validador (`spanish-gerunds.spec.ts`), incluidos falsos positivos.
- [x] Negaciones de skills faltantes: se marcan (`MISSING_SKILL`) y, si la corrección no las quita, se eliminan (`final`: 0 de 6).
- [x] Gerundio residual: 0 de 6 en la corrida final.
- [x] Chequeo de fidelidad automatizado en la medición (juez gpt-4o): 2 de 6 cartas con afirmaciones sin respaldo, revisadas arriba.
- [x] Años de experiencia: solo si el perfil los declara (`fidelity2`: ninguna carta con años sin respaldo).
- [x] Sector del empleador: solo si el perfil lo declara; el prompt ya no lo exige (`fidelity2`: ninguna carta con sector inventado).
- [x] Tests del validador y de la red de seguridad (años, sector, nivel de skill numérico).
- [ ] Revisión humana de las 6 cartas de `fidelity2`, incluida la limitación de P4-O4 (carta corta por falta de datos en el perfil).

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Muestras chicas dan resultados ruidosos | Repetir cada caso de CV (`EVAL_REPS`) y reportar cantidades, no solo porcentajes. |
| Falsos positivos del detector | Lista de excepciones y revisión manual de los ejemplos listados en el resumen. |
| Costo de tokens | Corridas acotadas: 6 pares, 3 repeticiones para CV, 1 para cartas. |
| El prompt empeora la fidelidad | El test de fidelidad de `cv-adaptation.service.spec.ts` y las advertencias de carta se revisan en cada corrida. |
