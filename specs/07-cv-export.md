# SPEC 07 — Exportación de CV (PDF y DOCX)

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-08-07
> **Objective:** Generar y descargar el CV derivado del Candidate Profile como PDF con texto real seleccionable (no imagen, para pasar filtros ATS) y como DOCX nativo, vía `GET /cv-export?format=pdf|docx&lang=es|en`, con un template estándar de una sola columna y títulos de sección en español o inglés.

## Scope

**In:**

- Backend: módulo `CvExportModule` que deriva el CV **solo** desde el `Profile` (SPEC 05) + `name`/`email` del `User`.
- `GET /cv-export?format=pdf|docx&lang=es|en` protegido por el guard global:
  - `format` requerido, `@IsIn(['pdf', 'docx'])`.
  - `lang` opcional, `@IsIn(['es', 'en'])`, default `es` (solo afecta los títulos de sección; el contenido se respeta tal cual está guardado en el perfil).
  - Respuesta binaria (`StreamableFile`) con `Content-Type` adecuado y `Content-Disposition: attachment` con nombre de archivo sanitizado del nombre del usuario.
- Generación de PDF con **pdfmake** (texto real y seleccionable; sin imágenes, sin renderizado a imagen).
- Generación de DOCX con la librería **`docx`** (npm), `.docx` nativo con el mismo contenido.
- Template estándar de una sola columna, ATS-friendly: header (nombre, headline, contacto) + summary + experience + skills + education + certifications + projects + languages. Las secciones vacías se omiten. Orden de items respeta `sortOrder` ascendente (SPEC 05). Fechas en `MM/YYYY`. Skills como `name` + nivel `n/5`. Idiomas como `name` + nivel CEFR.
- Frontend: en la página `/profile` (SPEC 05) dos botones — "Descargar PDF" y "Descargar DOCX" — que descargan el binario con `withCredentials` y manejan el nombre de archivo y errores.
- Tests: unitarios de `CvExportService` (PDF/DOCX generados, secciones vacías omitidas, idioma de títulos) y e2e de `cv-export` (401, 400, 200 con content-types correctos, contenido extraíble).

**Out of scope (para specs futuros):**

- CV adaptado a una oferta (keywords, matching, tailoring) — feature MVP propia con su spec.
- Varios templates/estilos seleccionables.
- Traducción del contenido del perfil; la exportación solo traduce los títulos de sección.
- Persistencia de los archivos generados (son derivados efímeros del perfil).
- Cover letters, CV en otros formatos (`.rtf`, `.html`), descarga en lote.

## Data model

Este spec **no introduce estructuras de datos nuevas**: no hay tablas ni campos nuevos. El CV es una derivación pura del `Profile` (SPEC 05) y del `User` (SPEC 04). Fuentes de datos:

- `User.name` y `User.email` para el header (el email no vive en el `Profile`).
- `Profile` + sus 6 colecciones para el resto, respetando `sortOrder`, con `source` (SPEC 06) irrelevante aquí: el documento se genera igual sin distinguir origen.
- Niveles existentes: `skill.level` 1–5, `language.level` CEFR (`A1`–`C2`). Se renderizan tal cual, sin inventar valores.

## Implementation plan

Cada paso deja el sistema compilable y funcionando.

1. Deps backend: `pdfmake` y `docx` (dependencies); `@types/pdfmake` (dev). Verificar el uso servidor de `pdfmake` (`pdfMake.createPdf(doc)` → `getBuffer()`) y el uso de su `vfs_fonts.js` bundleado (Roboto) para no gestionar fuentes manualmente; verificar el API instalado de `docx` (`Document`, `Packer.toBuffer`).
2. Crear `backend/src/cv-export/`:
   - `cv-export.service.ts`: 
     - `loadCvData(userId)`: arma una estructura normalizada (`CvData`) desde `PrismaService`: `name`, `email`, `headline`, `phone`, `location`, `website`, `linkedin`, `summary`, y las 6 colecciones ordenadas por `sortOrder`, descartando items incompletos (p. ej. `Experience` sin `company` o `position`).
     - `buildPdf(data, lang)` → `Buffer`: documento pdfmake de una sola columna; header con nombre, headline y contacto; secciones omitidas si vienen vacías; fechas `MM/YYYY`; skills `name (n/5)`; idiomas `name (CEFR)`.
     - `buildDocx(data, lang)` → `Buffer`: mismo contenido con `Document` de `docx`.
     - `headings(lang)`: mapa `es`/`en` para los títulos de sección (Summary/Resumen, Experience/Experiencia, Skills/Habilidades, Education/Educación, Certifications/Certificaciones, Projects/Proyectos, Languages/Idiomas).
   - `dto/cv-export-query.dto.ts`: `format` (`@IsIn(['pdf', 'docx'])`), `lang` (`@IsOptional() @IsIn(['es', 'en'])` default `'es'`).
   - `cv-export.controller.ts`: `GET /cv-export` protegido; `userId` del request (patrón SPEC 04); según `format` responde con `StreamableFile` y headers `Content-Type: application/pdf` (o `application/vnd.openxmlformats-officedocument.wordprocessingml.document`) y `Content-Disposition: attachment; filename="<slug>-CV.pdf|docx"` con el nombre del usuario sanitizado (`[^a-z0-9_-]` → `-`, lowercase).
   - `cv-export.module.ts` (importa `PrismaService`) y registro en `app.module.ts`.
3. Tests unitarios `backend/src/cv-export/cv-export.service.spec.ts`: PDF generado comienza con `%PDF`; DOCX es un zip válido (`PK`); secciones vacías omitidas; idioma de títulos cambia con `lang`; orden respeta `sortOrder`.
4. Tests e2e `backend/test/cv-export.e2e-spec.ts`: sin cookie → 401; `format` inválido → 400; `lang` inválido → 400; `format=pdf` → 200 con `Content-Type` PDF y body que empieza en `%PDF`; `format=docx` → 200 con `Content-Type` docx; el texto del PDF extraído con `pdf-parse` contiene datos del perfil (verificable); el texto del DOCX extraído con `mammoth` contiene los mismos datos.
5. Frontend: `core/cv-export.service.ts` con `download(format)` que hace `fetch(url, { credentials: 'include' })`, valida `ok` (401 → redirige a login), convierte a `Blob`, crea un object URL y dispara la descarga con el nombre del `Content-Disposition` (o uno fijo); sin `localStorage`.
6. Frontend: en `profile.component` agregar los botones "Descargar PDF" y "Descargar DOCX" (SCSS del scaffold), que llaman a `CvExportService.download('pdf' | 'docx')`; manejo de error simple (mensaje inline si la descarga falla).
7. Verificación final: `npm run build:all`, `npm run lint:all`, `npm run test -w career-analyzer-backend`, y flujo manual en navegador (login → `/profile` con datos → descargar PDF → el PDF se abre en visor y el texto es seleccionable/buscable → descargar DOCX → se abre en Word/WPS y se puede editar → `?lang=en` cambia títulos a inglés → sin sesión redirige).

## Acceptance criteria

- [ ] `GET /cv-export?format=pdf` con cookie → 200, `Content-Type: application/pdf`, body que comienza con `%PDF` y cuyo texto (extraído con `pdf-parse`) contiene los datos del perfil.
- [ ] `GET /cv-export?format=docx` con cookie → 200, `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`, y el texto extraído con `mammoth` contiene los datos del perfil.
- [ ] El PDF tiene texto real seleccionable/buscable (no es imagen): verificable extrayendo texto con `pdf-parse`; el DOCX se abre y edita en Word/WPS.
- [ ] Sin cookie → 401; `format` inválido (p. ej. `png`) → 400; `lang` inválido → 400.
- [ ] `lang=es` y `lang=en` cambian solo los títulos de sección; el contenido permanece idéntico.
- [ ] Las secciones vacías se omiten; los items se ordenan por `sortOrder` ascendente; fechas en `MM/YYYY`; skills como `name (n/5)`; idiomas como `name (CEFR)`.
- [ ] `Content-Disposition` incluye `filename` con el nombre del usuario sanitizado y extensión correcta.
- [ ] `npm run build:all` y `npm run lint:all` OK; `npm run test -w career-analyzer-backend` pasa (unit + e2e).
- [ ] `/profile` tiene los botones de descarga PDF/DOCX que descargan el binario con `withCredentials`; sin sesión la descarga redirige a `/auth/login`.
- [ ] No se persiste ningún archivo generado y no se usa `localStorage`.

## Decisions

- **Sí:** `pdfmake` para PDF. Genera PDF con texto real seleccionable (no imagen), declarativo, sin Chromium; cumple el requisito de que los filtros ATS no lo detecten como imagen/corrupto.
- **Sí:** librería `docx` para `.docx`. `Packer.toBuffer` produce el formato nativo sin intermediarios.
- **Sí:** un solo endpoint `GET /cv-export?format=pdf|docx&lang=es|en`. Un guard, un DTO, validación simple; `lang` hace que el idioma del documento sea independiente del de la UI (README).
- **Sí:** template estándar de una sola columna y fuentes del bundle de pdfmake (Roboto). Una columna y texto plano maximizan el parseo ATS; sin imágenes ni columnas que rompan la lectura.
- **Sí:** omitir secciones vacías y items incompletos, respetando `sortOrder`. El CV sale limpio aunque el perfil esté a medio completar.
- **Sí:** descarga con `fetch` + `Blob` en el frontend. Controla errores (401) y el nombre de archivo sin depender de navegación.
- **No:** CV adaptado por oferta, múltiples templates, traducción del contenido, persistencia de archivos generados, cover letters ni otros formatos — cada uno a su spec.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| API de `pdfmake`/`docx` cambia según versión instalada | El paso 1 verifica el API real (`createPdf/getBuffer`, `Document/Packer`) y los tests de servicio validan el output (`%PDF`, `PK`). |
| Fuentes de pdfmake no disponibles en el bundle | Usar el `vfs_fonts.js` bundleado (Roboto); si diera problema, se declara Helvetica, fuente estándar de PDF sin incrustar. |
| Perfil vacío o con items incompletos | Se omiten secciones/items vacíos; el documento siempre se genera si hay al menos `name`. |
| Caracteres extraños en el nombre para `filename` | Sanitización (`[^a-z0-9_-]` → `-`) antes de armar `Content-Disposition`. |
| ATS de los filtros rompe con PDF generado | El spec exige texto real y una sola columna; la verificación extrae el texto con `pdf-parse`/`mammoth` como criterio de aceptación. |
| Descarga falla en frontend (401/red) | `fetch` valida `ok`; 401 redirige a login; error genérico con mensaje inline. |

## What is **not** in this spec

- CV adaptado a una oferta (keywords, matching, tailoring).
- Múltiples templates o estilos seleccionables.
- Traducción del contenido del perfil (solo títulos).
- Persistencia de los documentos generados.
- Cover letters y otros formatos (`.rtf`, `.html`, lote).

Cada uno, si llega, tendrá su propio spec.
