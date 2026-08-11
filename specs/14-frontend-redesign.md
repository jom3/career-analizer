# SPEC 14 — Rediseño total del frontend (shell único + identidad visual + i18n es/en)

> **Status:** Approved
> **Depends on:** SPEC 01, 04–13 (frontends ya implementados)
> **Date:** 2026-08-10
> **Objective:** Rediseñar por completo la interfaz Angular con una identidad visual distintiva ("expediente profesional") recogida en design tokens, unificada en un shell único con navegación persistente organizada por el flujo real del producto, campos de formulario con anchos según el tipo de dato, y soporte de idioma de interfaz es/en con selector en el shell — todo 100% frontend, sin tocar el backend ni agregar librerías UI.

## Scope

**In:**

- **Identidad visual "expediente profesional"** (decisión de diseño, ver *Decisions*), codificada en design tokens:
  - Paleta: `--paper` `#F2F5F1` (papel frío levemente sage — explícitamente NO el cream `#F4F1EA` genérico), `--surface` `#FFFFFF`, `--ink` `#15251F` (tinta verde-oscura), `--accent` `#0E6B62` (verdigris) y `--accent-strong` `#0A554E` (hover), `--rule` `#E1E6DF`, `--muted` `#5B6B64`, `--amber` `#A2762F` (etiquetas IA / avisos), `--error` `#B3261E`.
  - Tipografía (3 roles) entregada **self-hosted por `@fontsource`** (sin Google Fonts en runtime):
    - Display/serif: **Newsreader** (títulos y wordmark) — pesos 600/700.
    - Cuerpo/grotesca: **Figtree** (texto, botones, etiquetas) — 400/500/600.
    - Datos/mono: **IBM Plex Mono** (eyebrows, etiquetas de estado, data) — 500.
  - Escala tipográfica, espaciado, radios (0; 0.25rem; 0.5rem; 1rem; suaves, sin sombras grandes), sombras sutiles, anillo de foco visible, y motion (transición única de entrada de vista 0.18s + hovers; respeta `prefers-reduced-motion`).
- **Shell único con navegación persistente** (sustituye el patrón "dashboard como hub" y los enlaces "Volver al dashboard"):
  - `ShellComponent` con **rail lateral izquierdo en tinta** (`--ink`) que organiza la navegación por el flujo real numerado — la numeración es semántica (es la secuencia del producto, no decoración):
    - **01 · Perfil** (`/profile`) con marca "Fuente de verdad".
    - **02 · Importar CV** (`/cv-import`).
    - **03 · Ofertas** (`/job-analysis`).
    - **04 · Encaje** (`/job-match`).
    - **05 · Documentos** (`/cv-adaptation`, `/cover-letter`) con ítems anidados "CV adaptado" y "Carta de motivación".
  - Header sobre el contenido: **wordmark tipográfico** "Career Analyzer" (Newsreader, sin logo ilustrado), **selector de idioma ES/EN**, nombre del usuario y "Cerrar sesión".
  - El contenido es una columna de "página de papel" centrada con márgenes (los resultados se ven como documentos, no como tarjetas flotantes).
- **Restyling de TODAS las pantallas** con la nueva identidad + textos traducidos:
  - Auth: `login` y `register`.
  - `dashboard`: se reescribe (ver abajo).
  - `profile`: formulario con **campos adaptados al contenido**.
  - `cv-import`, `job-analysis`, `job-match`, `cv-adaptation` (lista + detalle), `cover-letter` (lista + nuevo + detalle).
- **Campos adaptados al contenido** (anchos según tipo de dato):
  - Formularios en grid de 12 columnas con clases por peso de campo:
    - `field-xsmall` (span 2): año, día.
    - `field-small` (span 3): teléfono, fechas desde/hasta, nivel, CEFR.
    - `field-medium` (span 4): ubicación, rol, URL acortada.
    - `field-wide` (span 6): ubicación/stack, institución.
    - `field-full` (span 12): título profesional, empresa, puesto, descripciones, `summary`, notas, contenido de carta.
  - Un teléfono o una fecha ya no ocupan lo mismo que una descripción; la grid colapsa a 1 columna en móvil.
- **i18n de interfaz es/en** (liviano, sin librerías):
  - `I18nService` con signal `lang` y `t(key)`: lee los diccionarios `es.ts` / `en.ts` (`Record<string,string>`); `t()` se usa en plantillas y se re-renderiza solo porque la view trackea la signal.
  - Selector **ES/EN** en el header del shell (es/en; sin más idiomas en este spec).
  - Init: `localStorage` `career-analyzer-i18n` si existe; si no, detecta `navigator.language` (es → es; en → en; cualquier otro → es).
  - Al cambiar de idioma se actualiza `document.documentElement.lang`.
  - Se traducen **todos** los textos visibles actualmente hardcodeados: navegación, login/registro, dashboard, formularios, listas, detalles, empty states, banners `stale`, etiquetas IA, mensajes de error (incluidos los de `core/http-errors.ts`) y toasts. No hay strings visibles fuera de los diccionarios.
- **Dashboard reescrito como resumen con datos reales** + empty states:
  - Carga desde endpoints existentes (sin cambios de API): perfil (`GET /profile`), ofertas (`GET /job-analysis`), matches (`GET /job-match`), CV adaptados (`GET /cv-adaptation`) y cartas (`GET /cover-letter`).
  - Muestra: estado de completitud del perfil (calculado client-side: skills/experiencias/educación presentes), cantidad de ofertas analizadas y guardadas, cantidad de matches, y cantidad de documentos generados, con vínculos a cada sección.
  - Cada sección vacía muestra un empty state invitando a la acción (p. ej. "Todavía no analizaste ofertas → Analizar una oferta").
- **Distintivo de contenido generado**: etiquetas en mono (IBM Plex Mono) para artefactos IA — "GENERADO POR IA" sobre fondo `--amber` y banner de `stale` con el texto en el idioma activo — ya existentes en contenido, reestiladas y traducidas.
- **Responsive completo**: rail colapsa a drawer/rail-iconos en <900px, formularios a 1 columna en <600px, header compacto; foco visible en todo control interactivo; `prefers-reduced-motion` respetada.
- Tests: `i18n.service.spec.ts` (init desde localStorage, detección navegador con fallback es, `setLang` persiste, `t()` devuelve la clave traducida y la propia key si falta) y actualización de los specs existentes afectados por strings (p. ej. `app.spec.ts`) para que sigan pasando.

**Out of scope (para specs futuros):**

- Cualquier cambio de backend/API (migraciones, DTOs, endpoints): este spec es 100% frontend.
- i18n del **contenido generado por la IA** (documentos): siguen las reglas de idioma de SPEC 09/10/11/12/13; solo la UI es bilingüe.
- Modo oscuro (la identidad se define en claro).
- Librerías UI (Angular Material / Tailwind) y librerías de estado (NgRx) o de i18n (ngx-translate / `@angular/localize`).
- Logo ilustrado / favicon de marca nuevo.
- Animaciones complejas o librerías de motion (solo micro-transiciones CSS).
- Nuevos tests e2e de frontend.

## Data model

No hay nuevos datos ni en backend ni en `schema.prisma`. Sí aparecen nuevas **estructuras frontend**:

- `frontend/src/styles/_tokens.scss`, `_base.scss`, `_forms.scss`, `_components.scss` — partials SCSS importados por `styles.scss` (reemplaza el contenido actual).
- `frontend/src/app/core/i18n/es.ts` y `en.ts` — diccionarios `Record<string, string>` (una clave por string de UI, kebab-case, p. ej. `nav.profile`, `profile.save`, `dashboard.offersCount`).
- `frontend/src/app/core/i18n/i18n.service.ts` — `I18nService` (signal `lang`, `t(key)`, `init()`, `setLang(lang)`).
- `frontend/src/app/layout/shell.component.ts|html|scss` — el shell único.
- Dashboard: tipos de resumen derivados de los DTOs ya existentes (`profile.ts`, `job-analysis.ts`, `job-match.ts`, `adapted-cv.ts`, `cover-letter.ts`); no se crean modelos nuevos.
- Tipografías como dependencias npm: `@fontsource/newsreader`, `@fontsource/figtree`, `@fontsource/ibm-plex-mono` (dev→dependencies normales, pesan en el bundle por CSS import).

## Implementation plan

Cada paso deja el sistema compilable y funcionando.

1. **Dependencias de tipografía**: instalar `@fontsource/newsreader`, `@fontsource/figtree`, `@fontsource/ibm-plex-mono` en `frontend/package.json`; importar los CSS de los pesos usados en `main.ts`.
2. **Tokens y base**: crear los partials `_tokens.scss` (paleta, escala tipográfica, espaciado, radios, sombras, motion), `_base.scss` (reset, tipografía aplicada con `font-display: swap`, foco visible), `_forms.scss` (grid de 12 columnas y clases de span: `field-xsmall/small/medium/wide/full`, estilos de input/select/textarea/checkbox/errores) y `_components.scss` (botones primary/secondary/ghost/danger, cards, chips, badges, empty states, alertas, filas de listas, tags IA). Reescribir `styles.scss` para que solo importe estos partials (se eliminan las variables y clases genéricas actuales).
3. **i18n core**: crear `es.ts`, `en.ts`, `I18nService` (init en `app.config.ts` con provider; `lang` signal; `t(key)`; `setLang` persiste en `localStorage` y actualiza `document.documentElement.lang`). Crear `i18n.service.spec.ts`. Agregar el selector ES/EN al shell en un paso posterior.
4. **Shell y rutas**: crear `layout/shell.component.{ts,html,scss}` (rail en `--ink` con navegación numerada 01–05, wordmark Newsreader, selector de idioma ES/EN, usuario y logout, outlet de contenido en columna "página de papel"). Reestructurar `app.routes.ts`: `auth/login` y `auth/register` a nivel raíz; el resto como **hijos de `ShellComponent`** con `canActivate: [authGuard]` en el padre. Ajustar `app.html`/`app.ts` si hace falta (el shell es un componente de ruta, no se pinta en `app.html`). El cambio de idioma desde el rail rompe el "Volver al dashboard": se elimina ese enlace de todas las pantallas (cubierto en los pasos siguientes).
5. **Restyle auth**: `login` y `register` con la identidad (fondo `--paper`, tarjeta centrada como "documento", error traducido), textos vía `i18n.t()`.
6. **Restyle `profile` + campos adaptados**: rehacer `profile.component.html`/`.scss` con la grid de 12 columnas y spans por tipo (headline/empresa/puesto/descripciones/summary `field-full`; teléfono y fechas `field-small`; año `field-xsmall`; ubicación `field-medium`; nivel `field-small`; URLs `field-medium`; stack `field-wide`). Reordenar si hace falta para que el layout respire. Traducir todo; conservar la lógica de duplicados/overlap (ya construida) reestilada con los nuevos badges.
7. **Restyle `cv-import`** (dropzone/tarjeta, mensajes, errores, próximos pasos) traducido.
8. **Restyle `job-analysis`** (formulario de análisis, lista de ofertas guardadas, acciones "Adaptar CV"/"Carta de motivación") traducido y con empty states.
9. **Restyle `job-match`** (resumen de match, gaps, acciones) traducido.
10. **Restyle `cv-adaptation`** (lista + detalle): tarjetas como "documento", etiqueta "GENERADO POR IA", botones de descarga, banner `stale` traducido.
11. **Restyle `cover-letter`** (lista + nuevo + detalle): textarea editable como "página en blanco", etiqueta IA y banner `stale` traducidos, descargas PDF/DOCX.
12. **Dashboard resumen**: reescribir `dashboard.component` para cargar perfil + ofertas + matches + cv-adaptations + cover-letters (endpoints existentes), mostrar conteos y completitud del perfil, y empty states con CTA por sección. Traducido.
13. **Responsive y accesibilidad**: colapso del rail <900px, grid de formularios a 1 columna <600px, foco visible, `prefers-reduced-motion`; ajustar `index.html` (title "Career Analyzer", `lang` inicial) y favicon/meta coherentes.
14. **Sweep de i18n**: garantizar que no quede ningún string visible hardcodeado en español fuera de los diccionarios (revisión de plantillas y de `core/http-errors.ts`); actualizar `app.spec.ts` y cualquier spec de componente que aserte strings.
15. **Verificación final**: `npm run build:all`, `npm run lint:all`, `npm run test:all` (frontend con `ng test`; backend sin cambios) y flujo manual: login en español → cambiar a EN desde el rail → recorrer todas las pantallas verificando textos, campos con anchos correctos, shell persistente, dashboard con datos/empty states, etiquetas IA y banner stale en el idioma activo → recargar → el idioma persiste → probar responsive a 360px y 1200px.

## Acceptance criteria

- [ ] `npm run build:all`, `npm run lint:all` y `npm run test:all` pasan; el backend no se toca (0 diffs fuera de `frontend/` y `package.json` raíz si aplica).
- [ ] Existe un shell único con rail lateral en `--ink`, navegación persistente numerada (01 Perfil…05 Documentos), wordmark tipográfico "Career Analyzer", selector de idioma ES/EN y sesión del usuario; **ninguna** pantalla autenticada muestra "Volver al dashboard"; sin sesión redirige a `/auth/login`.
- [ ] La nueva identidad está en tokens: se aplican las 5+ variables de paleta definidas y las 3 tipografías `@fontsource` (Newsreader/Figtree/IBM Plex Mono) self-hosted; **no** se usa Google Fonts ni fallbacks de sistema para display/body; no quedan valores mágicos sueltos en los componentes (colores ≥ tokenizados).
- [ ] Los campos de formulario usan el sistema de spans de 12 columnas: teléfono/fechas/año/nivel ocupan menos columnas que empresa/descripción/`summary` (verificable revisando `profile.component.html`); a <600px todo pasa a 1 columna.
- [ ] `I18nService` con `t()` en todos los textos visibles: cambiar ES→EN en el header cambia **toda** la interfaz sin recargar, persiste en `localStorage`, y al recargar se respeta esa elección; sin preferencia guardada, `navigator.language` es/en → ese idioma, cualquier otro → es; `document.documentElement.lang` refleja el idioma activo.
- [ ] El dashboard carga datos reales de los endpoints existentes (conteo de ofertas, matches, documentos y completitud del perfil) y muestra empty states con CTA en cada sección vacía; no introduce llamadas nuevas al backend.
- [ ] Etiquetas y banners de contenido generado: "GENERADO POR IA" en mono sobre `--amber` en CV adaptado y carta; banner de `stale` con texto del idioma activo.
- [ ] `frontend/package.json` solo agrega `@fontsource/*`; no hay Material, Tailwind, ngx-translate ni NgRx.
- [ ] Responsive: el rail colapsa <900px, formularios a 1 columna <600px, foco visible en controles y `prefers-reduced-motion` respetada.
- [ ] No quedan strings visibles hardcodeados fuera de los diccionarios `es.ts`/`en.ts` (verificable por revisión; `http-errors.ts` traducido).
- [ ] No se toca `specs/.spec-config.yml` y la contribución es solo frontend.

## Decisions

- **Sí:** **shell único con rail lateral de flujo numerado (01–05).** "Página única" se interpretó como estructura de app única con navegación persistente, no como una sola vista cargada de todo. La numeración es semántica: repite la secuencia real del producto (perfil→importar→oferta→encaje→documentos), por lo que el uso de números es información, no decoración (criterio de la skill frontend-design).
- **Sí:** identidad **"expediente profesional"**. El material del producto son documentos profesionales y un perfil que es única fuente de verdad; el diseño lo traduce a papel frío (no cream `#F4F1EA`), tinta verde-oscura, acento verdigris y una columna de contenido como "página". Se descartan explícitamente los tres looks-genéricos (warm-cream+serif+terracotta, dark+neon, newspaper de hairline).
- **Sí:** tipografía trio **Newsreader / Figtree / IBM Plex Mono**, self-hosted con `@fontsource`. Sin Google Fonts en runtime; los pesos se limitan (latin) para no inflar el bundle. La mono en eyebrows/etiquetas de estado le da el registro de "datos verificados", coherente con el invariante de no inventar.
- **Sí:** **i18n es/en liviano con Signals**, sin `@angular/localize` ni ngx-translate (no agregar librerías sin necesidad clara, principios README). Preferencia en `localStorage`, detección `navigator.language` con fallback `es`, y selector visible en el header. La **interfaz** es independiente del idioma de los **documentos** (invariante README): el contenido generado mantiene las reglas de SPEC 09–13.
- **Sí:** **campos adaptados al contenido** vía grid de 12 columnas y spans por tipo de dato, en reemplazo del grid de 2 columnas que igualaba telefóno con descripciones.
- **Sí:** **dashboard como resumen real** con empty states, alimentado por endpoints existentes (0 cambios de API). Se reutiliza lo que ya devuelven los listados.
- **Sí:** diseño a base de **SCSS nativo + design tokens** (patrón del proyecto, sin librerías UI) y **wordmark tipográfico** en lugar de logo.
- **No:** cambios de backend, modo oscuro, librerías UI/estado/i18n, logo ilustrado, animaciones más allá de micro-transiciones CSS, y traducción del contenido generado por IA — se dejan a sus specs.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Refactor masivo rompe el render de alguna pantalla | Restyle pantalla por pantalla en pasos que compilan y pasan `ng test`; el shell se agrega primero y se migran las rutas hijas de a una. |
| Un string de UI queda sin traducir | `t()` obligatorio en toda plantilla + sweep final; criterio de aceptación de revisión bilingüe; `http-errors.ts` traducido. |
| Signals de i18n no re-renderizan las vistas | `t()` lee la signal `lang` dentro de la plantilla; las vistas de Angular trackean signals y se re-renderizan solas al cambiar. |
| El peso de las fuentes infla el bundle | `@fontsource` con subsets latin y pesos limitados (600/700 display, 400/500/600 body, 500 mono). |
| Colisión de clases CSS viejas con tokens nuevos | Eliminación de las variables/clases genéricas de `styles.scss` al migrar (paso 2) y selectores con especificidad controlada. |
| Specs de componentes existentes asertan strings viejos (`app.spec.ts`) | Se actualizan en el paso 14 junto a la traducción para que `ng test` siga verde. |
| Cambiar idioma desincroniza textos cargados del backend | Los textos de UI son client-side; los datos del backend (títulos de oferta, contenido de documentos) no se traducen (reglas de sus specs). |
| Modo oscuro pedido más adelante | La identidad se define solo en claro; los tokens se centralizan para poder extenderlos sin refactor. |

## What is **not** in this spec

- Cambios de backend/API (este spec es 100% frontend).
- Traducción del contenido generado por IA (documentos) — los documentos mantienen su idioma según SPEC 09–13.
- Modo oscuro.
- Angular Material, Tailwind, NgRx, ngx-translate o `@angular/localize`.
- Logo ilustrado / favicon de marca.
- Animaciones más allá de micro-transiciones CSS.
- Tests e2e nuevos de frontend.

Cada uno, si llega, tendrá su propio spec.