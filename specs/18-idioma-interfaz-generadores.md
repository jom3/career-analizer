# SPEC 18 — Idioma de interfaz en los generadores de contenido

> **Status:** Implemented
> **Depends on:** SPEC 17 (perfil bilingüe es/en), SPEC 09/10/11/12/13 (generadores), SPEC 14 (i18n UI)
> **Date:** 2026-08-19
> **Objective:** Hacer que todo el contenido generado (CV base exportado, CV adaptado, carta de motivación y análisis de match) se produzca en el idioma de la interfaz activa en lugar del idioma de la oferta, consumiendo el perfil bilingüe del SPEC 17 (seleccionando los campos del idioma objetivo con fallback al otro idioma). El idioma de la interfaz viaja del frontend al backend por el header HTTP global `Accept-Language`, con fallback a `es`. Este spec depende de que SPEC 17 esté implementado.

## Scope

**In:**

- **Header global `Accept-Language` (frontend → backend)**: el frontend envía el idioma de interfaz activo en **todas** las requests al backend:
  - En las llamadas `HttpClient` se agrega mediante un **interceptor HTTP global** que inyecta `Accept-Language: es|en` según `I18nService.lang()`.
  - En el `fetch` directo del `cv-export.service` (descarga del CV base) se agrega el mismo header manualmente.
- **Middleware/guard backend de idioma**: un provider global (p. ej. middleware o interceptor NestJS) lee `Accept-Language`, lo normaliza (`es`/`en`, cualquier otro → `es`) y lo expone para que los servicios lo usen como idioma objetivo de generación. Un helper `resolveUiLang(header)` con fallback `es`.
- **Consumo del perfil bilingüe por idioma**: un helper `selectLang(es, en, target)` que devuelve el valor del idioma objetivo y, si está vacío, el del otro idioma (fallback). Se usa al armar el contenido de cada generador con los campos del perfil en el idioma de la UI.
- **CV base exportado (SPEC 07)**: `cv-export.service.loadCvData` selecciona los campos del perfil en el idioma de la UI (con fallback al otro). El `query.lang` del endpoint pasa a ser un override opcional; si no viene, usa el header.
- **CV adaptado (SPEC 12)**: el idioma objetivo pasa a ser el de la UI (no `offer.sourceLanguage`). El contenido estructural (headline, summary, location, projects, education, certifications, languages) se arma con los campos del perfil en el idioma de la UI (con fallback). La IA reescribe `experiences[].description` en el idioma de la UI. El `summary` se toma del perfil en el idioma de la UI (con fallback) o se genera con el resumen determinista (SPEC 12) en ese idioma. El `sourceLanguage` persistido pasa a ser el idioma en que se generó (el de la UI).
- **Carta de motivación (SPEC 13)**: `lang` = idioma de la UI (no `resolveLetterLanguage(offer.sourceLanguage)`). El borrador y la carta persistida usan ese idioma; `sourceLanguage` guarda el idioma de generación.
- **Match (SPEC 09/10/11)**: el `lang` del match pasa a venir del header (el frontend ya no necesita enviarlo, aunque se mantiene el campo opcional del DTO por compatibilidad); si no viene, usa el header; si tampoco, `es`. El contenido IA del match (justificaciones, gaps, recomendaciones) se genera en el idioma de la UI.
- **Idioma de generación en documentos guardados**: cada documento generado (CV adaptado, carta, match) guarda el idioma en que se generó (el de la UI activa en ese momento) como su `sourceLanguage`/`lang`. Un documento ya generado se mantiene en su idioma; para cambiarlo se regenera (no se migra automáticamente al cambiar la UI).
- **Frontend**: ajustar los servicios de descarga (cv-export con fetch + header) y no enviar `lang` explícito donde ya no hace falta (queda cubierto por el header). El CV base exportado y las descargas de adaptado/carta usan el header.
- **Tests**: unitarios del helper de idioma (`resolveUiLang` con fallback), del selector bilingüe (`selectLang` con fallback), de cada generador (mockean el header y verifican que el idioma objetivo es el de la UI), y e2e (generar un CV adaptado/carta/match con UI en inglés y verificar que el contenido queda en inglés aunque la oferta sea en español; y viceversa).

**Out of scope (para specs futuros):**

- El perfil bilingüe y su traducción con revisión (es **SPEC 17**).
- Migrar/re-generar automáticamente documentos existentes al cambiar el idioma de la UI (los guardados se mantienen en su idioma de generación).
- Traducir el contenido de las ofertas (`JobOffer`) ni su `sourceLanguage`.
- Más de dos idiomas.
- Traducir nombres propios, skills, techStack, CEFR (no cambia; el perfil bilingüe ya los deja únicos y no traducibles).

## Data model

No hay cambios en `schema.prisma` ni migraciones nuevas. Se reutilizan las columnas `*_es`/`*_en` del perfil creadas en SPEC 17. Aparecen estas **estructuras de backend**:

- `backend/src/i18n/ui-lang.ts` — `type UiLang = 'es' | 'en'`, `resolveUiLang(header?: string): UiLang` (normaliza y cae a `es`) y `selectLang(es?: string | null, en?: string | null, target: UiLang): string | null` (devuelve el del idioma objetivo con fallback al otro).
- Provider global (middleware/interceptor) que lee `Accept-Language` y lo inyecta (p. ej. en un contexto de request) para que los servicios lo lean.

Convenciones:

- `UiLang` y los helpers viven en un módulo común importable por los servicios (`cv-export`, `cv-adaptation`, `cover-letter`, `job-match`).
- El header `Accept-Language` es el idioma de **interfaz**; los documentos guardados conservan su propio idioma de generación.
- El fallback del perfil: si un campo no tiene versión en el idioma de la UI, se usa la del otro idioma (nunca queda vacío si existe en algún idioma).

## Implementation plan

Cada paso deja el sistema compilable y funcionando.

1. **Helpers de idioma backend**: crear `backend/src/i18n/ui-lang.ts` con `resolveUiLang` y `selectLang`, y su `ui-lang.spec.ts` (normalización con fallback `es`, select con fallback al otro idioma). Registrar el módulo común.
2. **Provider de request del idioma**: crear un middleware/interceptor que lea `Accept-Language`, lo normalice con `resolveUiLang` y lo exponga (p. ej. en `@Req()` como `req.uiLang` o un provider request-scoped). Registrarlo globalmente en `app.module.ts`.
3. **CV base exportado**: en `cv-export.service.loadCvData`, seleccionar los campos del perfil con `selectLang(es, en, targetLang)` donde `targetLang` = `query.lang` (si viene) ?? `req.uiLang` ?? `es`. Actualizar el `cv-export.controller` para pasar el idioma del header cuando no viene `query.lang`. Tests.
4. **CV adaptado**: en `cv-adaptation.service.createForOffer`, usar `req.uiLang` como idioma objetivo en lugar de `offer.sourceLanguage`:
   - Armar el contenido base con los campos del perfil en ese idioma (selectLang por campo).
   - Pasar el idioma objetivo al parser IA para reescribir `experiences[].description`.
   - Resumen: `selectLang` del perfil o el determinista en ese idioma.
   - Persistir `sourceLanguage` = idioma de generación (el de la UI).
   - El controller pasa `req.uiLang`. Tests (mock header).
5. **Carta de motivación**: en `cover-letter.service`, `lang` = `req.uiLang` (no la oferta) para borrador y persistencia; `sourceLanguage` = idioma de generación. El controller pasa `req.uiLang`. Tests (mock header).
6. **Match**: en `job-match.controller`/`service`, usar `req.uiLang` como `lang` cuando el request no lo traiga (mantener el campo opcional del DTO por compatibilidad). El contenido IA del match se genera en ese idioma. Tests (mock header).
7. **Frontend — interceptor del header**: crear un `HttpInterceptor` que agrega `Accept-Language` = `i18n.lang()` en todas las requests. Registrarlo en `app.config.ts`.
8. **Frontend — cv-export con fetch**: en `cv-export.service.download`, agregar el header `Accept-Language` = `i18n.lang()` al `fetch`. Ajustar las descargas de adaptado/carta para no depender de `lang` explícito (queda cubierto por el header), manteniendo el override si existe.
9. **Verificación final**: `npm run build:all`, `npm run lint:all`, `npm run test:all`, y flujo manual (UI en inglés con oferta en español → exportar CV base en inglés; adaptar un CV → el contenido (headline, summary, proyectos, descripciones) queda en inglés; generar carta y match → en inglés; cambiar a español → regenerar y verificar que queda en español; recargar → los documentos guardados mantienen su idioma de generación).

## Acceptance criteria

- [ ] El frontend envía `Accept-Language` con el idioma de interfaz en todas las requests (`HttpClient` vía interceptor y `fetch` del cv-export); el backend lo normaliza con `resolveUiLang` (fallback `es`).
- [ ] Con la UI en inglés y una oferta en español: el CV base exportado, el CV adaptado, la carta y el match se generan **en inglés** (contenido, no solo títulos). Y a la inversa (UI en español, oferta en inglés → contenido en español).
- [ ] El CV adaptado toma los campos estructurales del perfil en el idioma de la UI (headline, summary, location, projects, education, certifications, languages) con fallback al otro idioma; la IA reescribe `experiences[].description` en el idioma de la UI; el summary se toma del perfil o del determinista en ese idioma.
- [ ] `sourceLanguage`/`lang` de cada documento guardado (CV adaptado, carta, match) es el idioma de generación (el de la UI activa al generarlo).
- [ ] Los documentos ya guardados se mantienen en su idioma de generación; cambiar el idioma de la UI no los migra automáticamente (se regenera para cambiarlos).
- [ ] El fallback del perfil: si un campo no tiene versión en el idioma de la UI, se usa la del otro idioma (nunca queda vacío si existe en algún idioma).
- [ ] Los campos no traducibles (skills, techStack, URLs, CEFR, fechas) se mantienen únicos y sin traducir.
- [ ] `npm run build:all`, `npm run lint:all` y `npm run test:all` pasan (frontend y backend).

## Decisions

- **Sí:** **header global `Accept-Language`** (interceptor HTTP + fetch manual) para comunicar el idioma de interfaz al backend. Centralizado, sin tocar cada endpoint, estándar HTTP.
- **Sí:** **los generadores usan el idioma de la interfaz** (no el de la oferta) para el contenido. Es el cambio que resuelve el problema reportado (proyectos del perfil en español apareciendo en un CV en inglés).
- **Sí:** **el contenido estructural se arma con los campos del perfil en el idioma de la UI con fallback al otro idioma.** Se consume el perfil bilingüe del SPEC 17; la IA solo reescribe `experiences[].description` (como hoy) pero en el idioma de la UI; el summary se toma del perfil o del determinista.
- **Sí:** **cada documento guardado conserva su idioma de generación** (`sourceLanguage`/`lang` = idioma de la UI al generar). Los documentos ya generados no se migran al cambiar la UI; se regeneran para cambiar de idioma.
- **Sí:** **el match usa el idioma del header** con el campo opcional del DTO como override de compatibilidad.
- **No:** migrar automáticamente documentos existentes al cambiar la UI, traducir ofertas (`JobOffer`), más de dos idiomas, traducir nombres propios/skills/techStack/CEFR (ya cubierto en SPEC 17).

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Un documento generado en un idioma distinto al de la UI actual se percibe como error | El documento guarda su idioma de generación y la UI lo etiqueta (badge IA + `documentLang`, ya en SPEC 14/16); se regenera para cambiar de idioma. |
| Un campo del perfil sin versión en el idioma de la UI deja huecos | `selectLang` cae al otro idioma; nunca queda vacío si existe en algún idioma. |
| El header no viaja en alguna request (p. ej. fetch de descarga) | Se agrega manualmente en el `fetch` del cv-export y vía interceptor en el resto; test e2e verifica el header. |
| Dependencia de SPEC 17 (perfil bilingüe) no implementado | Este spec declara `Depends on: SPEC 17`; sin el perfil bilingüe no hay campos `*_es`/`*_en` que seleccionar. Se implementa después del 17. |
| El match conserva `lang` en el DTO y el frontend lo enviaba | Se mantiene el campo opcional como override; el header es la fuente por defecto; el frontend deja de enviarlo. |
| Costo de IA al re-generar en otro idioma | Solo se re-genera por acción explícita del usuario (adaptar/generar carta/match); las lecturas nunca disparan IA. |

## What is **not** in this spec

- El perfil bilingüe y su traducción con revisión humana — **SPEC 17**.
- Migrar/re-generar automáticamente documentos existentes al cambiar el idioma de la UI.
- Traducir el contenido de las ofertas (`JobOffer`) ni su `sourceLanguage`.
- Más de dos idiomas.
- Traducir nombres propios, skills, techStack, CEFR.

Cada uno, si llega, tendrá su propio spec.
