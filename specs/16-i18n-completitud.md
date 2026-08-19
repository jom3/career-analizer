# SPEC 16 — Completitud y consistencia de i18n en toda la aplicación

> **Status:** Implemented
> **Depends on:** SPEC 14 (rediseño + i18n es/en)
> **Date:** 2026-08-19
> **Objective:** Auditar y corregir la consistencia de idioma de la interfaz en TODAS las pantallas de la app para que, con la UI en español o en inglés, no quede ningún texto visible sin adaptar ni se perciba una mezcla de idiomas: llevar todo string de UI detrás de `t()`, etiquetar claramente el contenido generado por IA que se conserva en el idioma de la oferta (sin cambiarlo), y agregar un guard de regresión (paridad de diccionarios + scan de literales) para que la inconsistencia no vuelva a aparecer.

## Scope

**In:**

- **Auditoría completa de i18n (sweep de TODAS las pantallas)**, no solo de las páginas ya detectadas:
  - Auth (`login`, `register`), shell (`shell.component`), `dashboard`, `profile`, `cv-import`, `job-analysis`, `job-match`, `cv-adaptation`, `cover-letter` (lista + nuevo + detalle).
  - Se inspecciona cada plantilla y cada `.ts` de componente (strings de estado, `errorMessage`, placeholders, `title`/`aria-label`, toasts, empty states, banners) para encontrar todo texto visible de UI que **no** pase por `i18n.t()`.
- **Completitud de diccionarios `es.ts`/`en.ts`**:
  - Se agregan las claves que falten; se garantiza que **ningún** string visible de la UI quede hardcodeado en español o en inglés fuera de los diccionarios.
  - **Paridad**: `es` y `en` tienen exactamente el mismo conjunto de claves (una traducción no puede quedar huérfana por clave faltante).
  - El fallback de `t()` (devolver la propia key si falta) deja de ser un camino silencioso: el guard de paridad lo convierte en error de build/test, no en texto roto en runtime.
- **Etiquetado del contenido generado por IA que se conserva en el idioma de la oferta** (decisión: NO se cambia el idioma del contenido, solo se etiqueta en la UI):
  - `cv-adaptation`: el badge `cvAdapt.aiTag` y la línea `cvAdapt.documentLang` ya existen; se verifica que el idioma del documento quede visible y claro en detalle y lista.
  - `cover-letter`: `coverLetter.draftLanguage` en el borrador; se verifica que en el detalle de la carta quede claro en qué idioma está el contenido si difiere de la interfaz.
  - `job-match`: los textos IA guardados (`overallJustification`, `dimension.justification`, `gap.note`, `recommendation.suggestion`, `item.target`) se conservan en el idioma de la oferta; los **labels** que los envuelven (`gapStatusLabel`, `gapSourceLabel`, `recommendationLabel`, `dimensionLabel`) ya pasan por `t()` y se auditan para que no queden claves sueltas. No se modifica el contenido semántico IA.
- **Guard de regresión** (mecanismo automático para que la mezcla no vuelva):
  - Test de **paridad de diccionarios**: `i18n.dictionaries.spec.ts` que verifica `Object.keys(es)` y `Object.keys(en)` son idénticos como conjuntos, y que no hay claves con valor vacío en ninguno.
  - Scan de literales de UI: test (o script de lint) que recorre las plantillas `.html` y detecta nodos de texto/interpolaciones que no pasen por `i18n.t()` (p. ej. un heurístico que marca texto estático entre tags que no contenga `i18n.t(`). Se define una lista blanca mínima de excepciones legítimas (números, porcentajes, CEFR `A1..C2`, niveles `1..5`, fechas, nombres propios, separadores `·`/`/`).
- **Tests**: nuevos `i18n.dictionaries.spec.ts` (paridad + no vacíos), actualización de `i18n.service.spec.ts` si cambia `t()`/fallback, y ajuste de cualquier spec de componente que aserte un string viejo o ahora traducido.

**Out of scope (para specs futuros):**

- Cambios de backend/API, migraciones ni DTOs (spec 100% frontend, igual que SPEC 14).
- Cambiar el idioma del contenido generado por IA (CV adaptado, carta, justificaciones del match): se conservan las reglas de idioma de oferta de SPEC 09/10/11/12/13; este spec solo etiqueta en la UI.
- Traducir automáticamente el contenido IA a otro idioma.
- Reorganización de layout/estructura de páginas (es competencia de SPEC 14; aquí solo textos).
- Añadir más idiomas (solo `es`/`en`).
- Cambiar la arquitectura de i18n (se mantiene `I18nService` con signals de SPEC 14; no se introduce ngx-translate ni `@angular/localize`).

## Data model

No hay cambios en backend ni en `schema.prisma`. No se introducen modelos nuevos. Sí aparecen nuevas **estructuras frontend**:

- `frontend/src/app/core/i18n/i18n.dictionaries.spec.ts` — test de paridad y no-vacíos entre `es.ts` y `en.ts`.
- Un helper de scan en el test (o script) que enumera las plantillas y detecta texto de UI fuera de `i18n.t()`, con su lista blanca de excepciones.
- Posibles claves nuevas en `es.ts`/`en.ts` según los hallazgos del sweep (nombres con prefijo por pantalla: `profile.*`, `jobAnalysis.*`, `jobMatch.*`, `cvAdapt.*`, `coverLetter.*`, `cvImport.*`, `dashboard.*`, `shell.*`, `auth.*`, `common.*`).

## Implementation plan

Cada paso deja el sistema compilable y funcionando.

1. **Inventario de strings visibles**: hacer un sweep de todas las plantillas y `.ts` de componentes listando todo texto de UI que no pase por `i18n.t()` (nodos de texto estáticos, placeholders, `title`/`aria-label`, mensajes de estado). Resultado: una lista exhaustiva de huecos (sin modificar código aún).
2. **Completar diccionarios**: para cada hueco del paso 1, decidir si es un string traducible (→ nueva clave en `es.ts` y `en.ts`) o una excepción legítima (números, CEFR, niveles, separadores, fechas → lista blanca). Agregar las claves nuevas a AMBOS diccionarios.
3. **Routar los huecos por `t()`**: en las plantillas/`.ts` correspondientes, reemplazar el texto hardcodeado por `i18n.t('clave')`. Verificar pantalla por pantalla que nada quede en bruto.
4. **Etiquetado del contenido IA**: revisar `cv-adaptation`, `cover-letter` (detalle y borrador) y `job-match` para confirmar que cuando el contenido generado está en un idioma distinto al de la interfaz, la UI lo indica (badge IA + idioma del documento visible). Agregar/ajustar claves de etiqueta solo si falta indicación clara; **no** tocar el contenido IA.
5. **Guard de paridad**: crear `i18n.dictionaries.spec.ts` que aserte que `es` y `en` tienen las mismas claves (como conjuntos) y que ninguna tiene valor vacío. Ajustar `i18n.service.spec.ts` si el fallback o el comportamiento cambia.
6. **Scan de literales de UI**: agregar el test/script que recorre las plantillas y marca texto estático fuera de `i18n.t()` (con la lista blanca del paso 2). Cualquier hallazgo nuevo lo vuelve fallo, para que futuros PR no reintroduzcan mezclas.
7. **Sweep final manual bilingüe**: con la app corriendo, recorrer cada pantalla en `es` y en `en` (y alternando el idioma desde el shell sin recargar), verificando: todos los textos cambian, ningún key aparece en bruto, el contenido IA etiquetado no se percibe como error, y `document.documentElement.lang` refleja el idioma.
8. **Verificación final**: `npm run build:all`, `npm run lint:all`, `npm run test:all` en la raíz; el backend no se toca (0 diffs fuera de `frontend/`).

## Acceptance criteria

- [ ] `npm run build:all`, `npm run lint:all` y `npm run test:all` pasan; **no** hay diffs fuera de `frontend/` (el backend no se toca).
- [ ] **Paridad de diccionarios**: `es.ts` y `en.ts` tienen exactamente el mismo conjunto de claves; `i18n.dictionaries.spec.ts` lo verifica y pasa (ninguna clave falta ni está vacía en ninguno de los dos).
- [ ] **Ningún string visible de UI queda hardcodeado fuera de `t()`**: el scan de literales pasa y la revisión manual no encuentra nodos de texto de UI en español o inglés fuera de los diccionarios en ninguna de las 9+ pantallas (auth, shell, dashboard, profile, cv-import, job-analysis, job-match, cv-adaptation, cover-letter).
- [ ] Cambiar `es`→`en` desde el shell cambia **toda** la interfaz sin recargar y sin que aparezca ninguna key en bruto (fallback `t()` nunca visible); `es` queda completo (sin strings en inglés residuales) y `en` completo (sin strings en español residuales).
- [ ] El contenido generado por IA (CV adaptado, carta, justificaciones/gaps/recomendaciones del match) se conserva en el idioma de la oferta y la UI lo etiqueta claramente (badge IA + idioma del documento/`documentLang`) cuando difiere del idioma de la interfaz; no se modifica el contenido IA.
- [ ] `http-errors.ts` y los mensajes de estado de los componentes devuelven claves (`*Key`) y se renderizan vía `t()`; ningún mensaje de error visible queda en bruto.
- [ ] Existe el guard de regresión: un cambio futuro que agregue un string de UI sin pasar por `t()` o que rompa la paridad de diccionarios hace fallar el test (no es solo una revisión manual).
- [ ] No se agregan librerías de i18n (ngx-translate, `@angular/localize`); se mantiene `I18nService` con signals de SPEC 14.
- [ ] No se toca `specs/.spec-config.yml`; la contribución es solo `frontend/`.

## Decisions

- **Sí:** **sweep completo + corrección directa**, no solo las páginas ya detectadas. El problema reportado ("en inglés no todo está adaptado / mezcla de idiomas") se percibe de forma dispersa; la única forma de cerrarlo con criterio verificable es barrer todas las pantallas, no parchear las conocidas.
- **Sí:** **mantener el idioma de oferta del contenido IA y etiquetarlo en la UI**, en lugar de cambiarlo. Cambiar el idioma del contenido rompería SPEC 09/10/11/12/13 y la invariante de idioma de oferta; etiquetar (badge IA + `documentLang`) resuelve la percepción de "mezcla" sin alterar el dato ni re-pagar IA.
- **Sí:** **guard de regresión automático** (paridad de diccionarios + scan de literales de UI). Sin él, el arreglo es de una sola pasada y la mezcla vuelve con el próximo string que no pase por `t()`. Con él, la consistencia es una propiedad mantenible, coherente con el principio de DRY y de "sin regresiones".
- **Sí:** el **fallback de `t()`** (devolver la key) se mantiene como red de seguridad en runtime, pero deja de ser un camino silencioso: la paridad lo convierte en fallo de test, no en texto roto visible.
- **Sí:** se reutiliza `I18nService` y los diccionarios `es.ts`/`en.ts` de SPEC 14; no se agregan librerías de i18n (principios README: no introducir tecnologías sin requerimiento).
- **Sí (durante la implementación):** los 7 componentes con `messageFor` dejan de mostrar el `error.message` del backend en bruto y mapean el estado HTTP a claves localizadas (`error400/404/413/422/errorCors/errorServer/errorGeneric`). Se decidió así porque el backend envía mensajes en inglés (NestJS) que rompían la coherencia de la UI en español; el detalle específico del backend se pierde a favor de mensajes localizados. Para mostrar el detalle del backend en el idioma correcto haría falta localizar los mensajes en el backend (fuera del alcance de este spec 100% frontend).
- **No:** cambios de backend, cambio de idioma del contenido IA, traducción automática del contenido IA, reorganización de layout (SPEC 14), nuevos idiomas, ni sustitución de la arquitectura de i18n.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| El sweep manual se queda corto y quedan strings sin traducir | Guard de scan de literales + revisión bilingüe pantalla por pantalla como criterio de aceptación; cualquier hallazgo nuevo falla el test. |
| El scan de literales marca falsos positivos (números, CEFR, fechas) | Lista blanca explícita de excepciones legítimas (definida en el paso 2) y revisión del heurístico. |
| El fallback de `t()` devuelve una key visible si falta una clave | La paridad de diccionarios hace que una clave faltante falle el test antes de llegar a runtime. |
| Cambiar el idioma de la interfaz desincroniza el contenido IA etiquetado | El contenido IA no se traduce; solo se etiqueta (badge + idioma del documento). Sin lógica de sincronización de texto. |
| Specs de componentes existentes asertan strings viejos | Se actualizan en el paso 8 junto a la traducción para que `ng test` siga verde. |
| Contenido IA guardado en español se muestra con UI en inglés (o viceversa) y parece un error | Etiquetado claro (`documentLang`/badge IA) en detalle y lista, verificado en el sweep bilingüe. |

## What is **not** in this spec

- Cambios de backend/API, migraciones o DTOs.
- Cambiar el idioma del contenido generado por IA (CV adaptado, carta, justificaciones/gaps/recomendaciones del match).
- Traducción automática del contenido IA a otro idioma.
- Reorganización de layout/estructura de las páginas (SPEC 14).
- Añadir más idiomas (solo `es`/`en`).
- Sustituir la arquitectura de i18n o agregar librerías (ngx-translate, `@angular/localize`).

Cada uno, si llega, tendrá su propio spec.
