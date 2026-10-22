# SPEC 21 — Calidad de generación: validadores deterministas

> **Status:** Approved
> **Depends on:** SPEC 12 (adaptación de CV), SPEC 13 (carta de motivación), SPEC 22 (idioma de documento)
> **Date:** 2026-10-22
> **Objective:** Que las reglas de calidad de la carta y del CV adaptado se verifiquen en código y no solo se pidan al modelo. Reducir el prompt de la carta, eliminar la segunda pasada de IA abierta, y corregir la comparación de skills que descarta descripciones válidas.
> **Orden de implementación:** 3.º (último).

## Scope

**In:**

- **Prompt de carta reducido y versionado:** de ~180 líneas a un conjunto corto de reglas, en un archivo propio con `PROMPT_VERSION`.
- **Validadores deterministas** para la carta: límite de palabras, frases prohibidas, nombres de empleadores del perfil, nombre de la empresa destino repetido, cierre genérico y adjetivos vacíos.
- **Auditoría condicional:** una sola llamada de corrección, y solo si fallan los validadores. Se le pasa la lista exacta de infracciones, no una instrucción abierta.
- **Advertencias en lugar de bloqueos:** si tras la corrección sigue habiendo infracciones, la carta se entrega con `warnings` visibles.
- **Corrección de `mentionsSkill`** (CV adaptado): comparación por palabra completa, con soporte para skills con símbolos (`C++`, `C#`, `.NET`, `Node.js`).
- **Alineación código-tests-documentación** del idioma del CV adaptado (hoy el test dice "idioma de la oferta" y el código usa el idioma de la interfaz).
- **Texto de usuario en español fijo** en `job-parser.service.ts` (`'Analizá la siguiente imagen...'`) pasa a un texto neutro en inglés, como el resto de los prompts.

**Out:**

- Reescribir el prompt del CV adaptado (solo se corrige la validación de skills).
- Validar gerundios y cláusulas "que + verbo" en código. Se deja a la IA: detectarlos con reglas es frágil.
- Revisión humana automática.

## Decisions

- **Sí:** **límite de 180 palabras** se valida en código, contando tokens separados por espacios.
- **Sí:** **lista de frases prohibidas corta y exacta**: "esto se alinea con los requerimientos del puesto", "lo que permitió", "tecnologías relevantes", "tecnologías clave", "quedo atento a su respuesta", "espero con interés". Ampliarla requiere un caso en `letter-validation.json`.
- **Sí:** **adjetivos vacíos** (`clave`, `relevante(s)`, `eficiente(s)`, `fundamental(es)`, `avanzado`, `óptimo`, `sólido`, `robusto`, `innovador`) se permiten solo si hay un número o nombre propio a menos de 5 palabras de distancia.
- **Sí:** **nombres de empleadores** = `experiences[].company` del perfil. Si aparecen en el texto, es infracción. El nombre de la empresa destino puede aparecer una vez.
- **Sí:** **máximo dos llamadas a IA** por generación: borrador y, si hace falta, corrección.
- **Sí:** **advertencias, no bloqueo.** La carta se entrega aunque quede una infracción; el usuario la ve antes de guardar.
- **No:** bloquear el guardado por advertencias.

## Data model

Migración `letter_prompt_version`:

```prisma
model CoverLetter {
  // ...columnas existentes...
  promptVersion Int @default(1)
}
```

Respuesta de `POST /cover-letter/draft` (aditiva):

```ts
interface CoverLetterDraftDto {
  content: string;
  sourceLanguage: 'es' | 'en';
  wordCount: number;
  warnings: { code: CoverLetterWarningCode; detail?: string }[];
}

type CoverLetterWarningCode =
  | 'WORD_LIMIT'
  | 'BANNED_PHRASE'
  | 'EMPLOYER_NAME'
  | 'TARGET_COMPANY_REPEATED'
  | 'GENERIC_CLOSING'
  | 'EMPTY_ADJECTIVE';
```

## Implementation plan

1. **Validadores:** crear `backend/src/cover-letter/letter-validators.ts` con funciones puras: `validateLetter(content, { lang, employers, targetCompany })` → `warnings[]`. Un validador por código, cada uno testeable por separado.
2. **Prompt reducido:** mover el prompt a `backend/src/cover-letter/prompts/cover-letter.prompt.ts`, exportar `COVER_LETTER_PROMPT_VERSION = 2` y el texto de sistema. Reglas: tono natural, no inventar, cierre con próximo paso, sin nombres de empleadores, un dato concreto por párrafo.
3. **Flujo de generación:** `draft` → `validateLetter` → si hay advertencias, una llamada de corrección con la lista exacta de infracciones → `validateLetter` → si quedan advertencias, se devuelven con `warnings`.
4. **Llamada de corrección:** prompt fijo: "Corregí solo estas infracciones: [lista]. No agregues datos nuevos. Devolvé la carta completa." `temperature: 0`.
5. **Persistencia:** al guardar, se guarda `promptVersion` (2). Las cartas existentes quedan con 1 y el historial lo muestra como antigua.
6. **`mentionsSkill`:** reemplazar `text.includes(skill)` por una expresión regular con límites de palabra adaptados a símbolos: `(?<![\w+#.])` + escape(skill) + `(?![\w+#])`, insensible a mayúsculas. Caso `Node` con `Node.js`: el punto no es carácter de palabra en este patrón, por eso matchea (ver `m09`).
7. **Idioma del CV:** `CvAdaptationParserService.adapt` recibe `documentLang` explícito (contrato de SPEC 22). Corregir el test "instruye escribir en el idioma de la oferta" para que verifique `documentLang`.
8. **Prompt de imagen:** `job-parser.service.ts` usa un texto neutro en inglés para el mensaje de usuario.
9. **Tests:** ver sección de tests.

## Tests

**Unitarios de validadores (`letter-validators.spec.ts`):** los 10 casos de `letter-validation.json`. Cada caso produce exactamente los códigos esperados en `expect.violations`.

**Unitarios de `mentionsSkill` (`cv-adaptation-parser.service.spec.ts`):** los 12 casos de `skill-mentions.json`, incluido `m01` (`good` no es `Go`) y `m02` (`JavaScript` no es `Java`).

**Unitarios del flujo:**

- Borrador sin infracciones → 1 llamada a IA, sin `warnings`.
- Borrador con infracción → 2 llamadas; la segunda recibe la lista exacta de infracciones.
- Infracción persistente tras corrección → 2 llamadas, respuesta con `warnings`, no error.
- Nunca más de 2 llamadas por generación.

**Regresión:** `cv-adaptation-parser.service.spec.ts` descarta las descripciones que mencionan un skill faltante, pero no las que mencionan un skill que no es el faltante (`JavaScript` con `Java` faltante).

## Acceptance criteria

- [ ] `letter-validators.ts` implementado como funciones puras; los 10 casos de `letter-validation.json` pasan.
- [ ] El prompt de carta vive en su archivo, tiene menos de 40 líneas y `PROMPT_VERSION = 2`.
- [ ] Una generación hace como máximo 2 llamadas a IA.
- [ ] La corrección recibe la lista exacta de infracciones, no una instrucción abierta.
- [ ] Una carta con infracciones persistentes se entrega con `warnings` y no falla.
- [ ] `mentionsSkill` pasa los 12 casos de `skill-mentions.json`.
- [ ] El test de idioma del CV verifica `documentLang`, no `sourceLanguage`.
- [ ] No quedan strings de usuario en español fijo en los parsers de IA.
- [ ] `npm run build:all`, `npm run lint:all` y `npm run test:all` pasan.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Los validadores son estrictos y marcan cartas buenas | Lista corta y exacta; cada regla tiene caso de prueba; las advertencias no bloquean. |
| El prompt reducido empeora la redacción | Comparar cartas con el prompt v1 y v2 sobre los mismos datos antes de cambiar `PROMPT_VERSION`. |
| La corrección introduce datos nuevos | Prompt de corrección cerrado: solo puede quitar o reformular las frases señaladas. |
| Regex de skills con símbolos inesperados | Casos `m04`, `m05` y `m11` cubren `C++`, `C#` y `Angular.js`. |

## What is **not** in this spec

- Validación de gerundios y cláusulas "que + verbo" en código.
- Revisión humana automática.
- Cambios en el prompt del CV adaptado más allá de la validación de skills.
