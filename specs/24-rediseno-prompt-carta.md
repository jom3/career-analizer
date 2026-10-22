# SPEC 24 — Rediseño del prompt de carta

> **Status:** Approved
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
