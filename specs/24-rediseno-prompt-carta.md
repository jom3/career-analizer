# SPEC 24 — Rediseño del prompt de carta

> **Status:** Implemented
> **Depends on:** SPEC 13 (carta), SPEC 21 (validadores y prompt v2), SPEC 20 (rúbrica como precedente de evaluación)
> **Date:** 2026-10-22
> **Objective:** Recuperar la calidad de redacción que tenía el prompt largo, manteniendo el prompt corto y versionado de SPEC 21 y sus validadores. El prompt v2 cumple el contrato pero produce párrafos de relleno y cláusulas de justificación que el usuario percibe como texto genérico.

## Contexto

SPEC 21 redujo el prompt de ~180 líneas a 37-39 y agregó validadores deterministas. La comparación manual mostró que v2 es más débil:

- Párrafos que solo evalúan ("me han permitido adquirir un enfoque analítico").
- Cláusulas "lo que me permite" que los validadores no detectan (solo `lo que permitió`).
- Aparición de cifras inventadas cuando la regla de adjetivos se redactó como "salvo que tenga un número".

## Scope

**In:**

- Rediseñar el prompt con ejemplos negativos breves, sin volver al prompt de 180 líneas.
- Ampliar la lista de frases prohibidas a la familia "lo que me permite/permite" y a la entusiasmo genérico, con sus casos en `letter-validation.json`.
- Agregar al validador una comprobación de cifras inventadas: todo número en la carta debe existir en el perfil o en la oferta.
- Evaluación comparativa A/B con datos reales sintéticos.

**Out:**

- Cambiar de modelo.
- Cambiar el flujo de dos llamadas.
- Reescribir los validadores existentes.

## Implementation plan

1. **Banco de pruebas de redacción:** script `npm run test:letter-eval` con 3 perfiles sintéticos × 2 ofertas, que genera cartas y guarda las salidas para comparar versiones del prompt.
2. **Cifras verificables:** validador `UNSUPPORTED_NUMBER`: extraer números de la carta (excluyendo años y porcentajes presentes en el perfil u oferta) y marcar los que no tengan respaldo. Casos nuevos en `letter-validation.json`.
3. **Frases prohibidas ampliadas:** `lo que me permite`, `lo que permite`, `estoy entusiasmado`, `estoy emocionado`, `i am excited`, `i am passionate`, `espero su respuesta`. Un caso por frase.
4. **Prompt v3:** reintroducir el patrón "hechos primero, prosa después" y 2 ejemplos negativos cortos, manteniendo el archivo por debajo de 45 líneas y `PROMPT_VERSION = 3`.
5. **Comparación A/B:** correr el banco con v2 y con v3 sobre los mismos datos; la decisión se toma con las salidas a la vista.
6. **Persistencia:** las cartas nuevas guardan `promptVersion = 3`; las anteriores conservan su versión.
7. **Documentación:** registrar en el spec la comparación y el criterio de elección.

## A/B comparison (resultado)

Corrido con `npm run test:letter-eval -w career-analyzer-backend` sobre 3 perfiles × 2 ofertas sintéticas, mismo modelo y `temperature 0`.

| Caso | v2 palabras | v2 advertencias | v3 palabras | v3 advertencias |
| --- | --- | --- | --- | --- |
| P1-O1 | 130 | BANNED_PHRASE, EMPTY_ADJECTIVE | 68 | — |
| P1-O4 | 117 | EMPTY_ADJECTIVE | 63 | — |
| P3-O4 | 82 | BANNED_PHRASE, EMPTY_ADJECTIVE | 85 | — |
| P3-O1 | 97 | EMPTY_ADJECTIVE | 82 | — |
| P4-O1 | 85 | — | 57 | — |
| P4-O4 | 76 | — | 53 | — |

**Totales:** v2 acumuló 5 advertencias en 6 cartas; v3, ninguna.

**Muestra v2 (P3-O4):** «Cuento con experiencia como Analista de Datos en el sector de análisis de datos. […] Manejo Python y SQL a un nivel avanzado. […] Saludos cordiales,». Tres problemas: párrafo que solo evalúa, adjetivo vacío y una despedida que el sistema ya agrega.

**Muestra v3 (P3-O4):** «Utilicé Python y scikit-learn para desarrollar un modelo de clasificación en el proyecto de predicción de bajas de clientes. Implementé consultas SQL para construir tableros de ventas en Power BI en mi rol como Analista de Datos. […]». Hechos verificables, sin despedida duplicada.

**Decisión:** se adopta v3 (`COVER_LETTER_PROMPT_VERSION = 3`). Las cartas son más cortas (53-85 palabras) porque los perfiles de prueba tienen pocos hechos; el largo no es un criterio de calidad por sí mismo, y el objetivo declarado es 90-150.

**Limitación observada:** v3 todavía puede dejar una cláusula de gerundio («reduciendo el tiempo…»). Los gerundios no se validan en código (fuera de alcance) y quedan para revisión humana.

## Acceptance criteria

- [ ] Existe el banco `test:letter-eval` y corre con datos sintéticos.
- [ ] El validador detecta cifras sin respaldo en el perfil o la oferta.
- [ ] Las frases prohibidas ampliadas tienen caso y test.
- [ ] El prompt v3 mide menos de 45 líneas y `PROMPT_VERSION = 3`.
- [ ] La comparación A/B queda documentada con las salidas de v2 y v3.
- [ ] Las cartas generadas con v3 no contienen párrafos de solo evaluación en la revisión manual documentada.
- [ ] `npm run build:all`, `npm run lint:all` y `npm run test:all` pasan.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Volver a un prompt enorme | Límite de 45 líneas verificado en el criterio. |
| El validador de cifras marca años o fechas | Excluir años de 4 dígitos y comparar contra los snapshots. |
| Sobreajustar al banco de pruebas | El banco es sintético y la decisión se documenta, no se automatiza como umbral. |
