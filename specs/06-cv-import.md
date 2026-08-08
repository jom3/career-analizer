# SPEC 06 — Importación de CV

> **Status:** Approved
> **Depends on:** SPEC 03, SPEC 04, SPEC 05
> **Date:** 2026-08-07
> **Objective:** Subir un CV en PDF o DOCX, extraer su texto, parsearlo con la API de OpenAI hacia un borrador del Candidate Profile, chequearlo contra criterios ATS y persistir archivo, texto y borrador, para que el usuario lo revise, edite y confirme antes de aplicarlo al perfil con el campo `source`.

## Scope

**In:**

- Backend: modelo `CvDocument` en Prisma (archivo, texto extraído, idioma detectado, borrador JSON) + campo `source` (enum `USER`/`CV_IMPORT`/`AI`, este spec solo usa `USER` y `CV_IMPORT`) en `Profile` y los 6 modelos de items de SPEC 05, con migración.
- Subida con **Multer** (disk storage local `backend/uploads/`, gitignored): validación de mimetype (`application/pdf` y `application/vnd.openxmlformats-officedocument.wordprocessingml.document`), límite de 10MB.
- Extracción de texto con **pdf-parse** (PDF) y **mammoth** (DOCX). Si el texto extraído es vacío o menor a un umbral → 422 con mensaje claro.
- Parseo con IA vía `OpenaiService` (SPEC 03) usando **structured outputs** (JSON Schema) del SDK oficial, con modelo `OPENAI_MODEL` configurable por env (default `gpt-4o-mini`). El resultado es un **borrador** que solo contiene datos presentes en el texto (nunca inventa).
- Chequeo ATS post-parse: reporte booleano por cheque (`contact`, `headline`, `summary`, `experience`, `skills`, `education`, `languages`) que acompaña al borrador.
- API REST protegido por el guard global:
  - `POST /cv-import` (multipart, campo `file`) → persiste `CvDocument` (archivo + texto + borrador) y devuelve `{ documentId, draft, sourceLanguage, atsReport }`.
  - `GET /cv-import/:id` → devuelve metadatos del documento y su borrador (recuperación si el usuario recarga a mitad de la revisión).
- Aplicación al perfil: **no hay endpoint nuevo**. El borrador se edita en el frontend y se aplica con el `PUT /profile` existente de SPEC 05, ampliado para persistir `source` por item.
- Extensión de `ProfileDto` y DTOs de items (SPEC 05) con `source` opcional (`@IsEnum(Source)`); `replaceForUser` persiste `source` en el upsert.
- Variable `OPENAI_MODEL` en `backend/.env` y `.env.example`, validada con Joi (default `gpt-4o-mini`) — completa la config diferida en SPEC 03.
- Frontend: página `/cv-import` protegida (widget de subida, reporte ATS, preview editable del borrador reusando los editores de sección de `/profile`) y `CvImportService`. Confirmar → `PUT /profile` con el payload llevando `source` por item.
- Tests: unitarios (text extractor, ats check, parser con OpenAI mockeado, service) y e2e (upload PDF/DOCX, mime inválido, texto no extraíble, apply con `source`, GET documento).

**Out of scope (para specs futuros):**

- Exportación de CV en PDF/DOCX (spec propio, siguiente).
- Enriquecimiento de datos faltantes por IA (valor `AI` del enum `source`).
- Traducción del CV a otro idioma al importar; el texto se guarda como viene.
- OCR para PDFs escaneados / sin capa de texto.
- Comparación o merge entre múltiples CVs del mismo usuario.
- Almacenamiento de objetos (S3/cloud) y cualquier cambio en infraestructura.
- Optimización ATS con keywords por job (es de la generación de CV).

## Data model

Agregar el enum `Source` y el modelo `CvDocument`; agregar `source` a `Profile` y a los 6 modelos de items de SPEC 05, y la relación en `User`:

```prisma
enum Source {
  USER
  CV_IMPORT
  AI
}

model User {
  // ... campos de SPEC 04/05
  cvDocuments CvDocument[]
}

model Profile {
  // ... campos de SPEC 05
  source Source @default(USER)
}

model Experience {
  // ... campos de SPEC 05
  source Source @default(USER)
}

model Skill {
  // ... campos de SPEC 05
  source Source @default(USER)
}

model Education {
  // ... campos de SPEC 05
  source Source @default(USER)
}

model Certification {
  // ... campos de SPEC 05
  source Source @default(USER)
}

model Project {
  // ... campos de SPEC 05
  source Source @default(USER)
}

model Language {
  // ... campos de SPEC 05
  source Source @default(USER)
}

model CvDocument {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  originalName   String
  mimeType       String
  storagePath    String
  extractedText  String   @db.Text
  sourceLanguage String?
  model          String?
  draftJson      Json?
  createdAt      DateTime @default(now())
}
```

Convenciones:

- `source`: `USER` (manual, default) o `CV_IMPORT` (todo lo que viene del parseo confirmado). `AI` queda reservado para el futuro enriquecimiento.
- `CvDocument.draftJson` guarda el borrador devuelto por la IA tal cual, para auditoría y para recuperar la revisión tras recargar.
- `CvDocument.extractedText` es el texto crudo extraído (fuente de verdad para verificar que la IA no inventó).
- El archivo binario vive en `backend/uploads/` (gitignored); `storagePath` guarda la ruta relativa.
- No hay tabla de `CandidateProfile` nueva: la importación alimenta el `Profile` de SPEC 05.

**Borrador (draft):** el parseo devuelve la misma forma del agregado de `ProfileDto` (SPEC 05) pero relajado: los campos obligatorios de los items (p. ej. `skill.level`, `experience.position`) pueden venir `null` cuando el CV no aporta evidencia, y todo item trae `source: CV_IMPORT`. La validación estricta corre al confirmar con `PUT /profile`.

## Implementation plan

Cada paso deja el sistema compilable y funcionando.

1. En `backend/prisma/schema.prisma`: agregar el enum `Source`, el campo `source @default(USER)` a `Profile` y los 6 modelos de items, el modelo `CvDocument` y la relación en `User`. Ejecutar `prisma migrate dev` (nombre `cv_import`) y `prisma generate`.
2. Deps backend: `pdf-parse`, `mammoth` (dependencies); `multer` + `@types/multer` (dev). Verificar la API instalada de `pdf-parse` (v1 devuelve `{ text }` desde callback; v2+ expone `pdf(buffer)` → `{ text }`) y adaptar el extractor al resultado. Crear `backend/uploads/` y agregarlo a `.gitignore`. Agregar `OPENAI_MODEL=gpt-4o-mini` a `backend/.env` y `.env.example`; ampliar el `validationSchema` Joi de `app.module.ts` con `OPENAI_MODEL: Joi.string().default('gpt-4o-mini')`.
3. Crear `backend/src/cv-import/text-extractor.service.ts`: `extract(buffer, mimeType): Promise<string>` — PDF con `pdf-parse`, DOCX con `mammoth.extractRawText`. Si `text.trim().length < 50` → `UnprocessableEntityException` (422) con mensaje claro ("no se pudo extraer texto; el PDF puede ser escaneado").
4. Crear `backend/src/cv-import/cv-parser.service.ts`: inyecta `OpenaiService`; construye un JSON Schema (structured outputs) con la forma del borrador; prompt en el idioma del CV que instruye extraer **solo** datos presentes en el texto, dejar `null` lo incierto, no inventar ni rellenar; detecta el idioma del texto (`es`/`en`/otro). Devuelve `{ draft, sourceLanguage }`. Valida que la respuesta sea JSON parseable y con la forma esperada; si falla → `BadGatewayException`/422 con mensaje de reintento.
5. Crear `backend/src/cv-import/ats-check.service.ts`: `check(draft): AtsCheckItem[]` con cheques booleanos y mensaje: `contact` (teléfono/ubicación), `headline`, `summary` (≥80 caracteres), `experience` (≥1 con empresa+posición+al menos una fecha), `skills` (≥3), `education` (≥1), `languages` (≥1).
6. Crear `backend/src/cv-import/cv-import.service.ts` y `cv-import.controller.ts`:
   - `POST /cv-import` (multipart, campo `file`; `FileInterceptor` con disk storage, fileFilter de mimetype → 400 si no es PDF/DOCX, limits 10MB): extrae texto (paso 3), parsea (paso 4), chequea ATS (paso 5), crea `CvDocument` (archivo + texto + idioma + modelo + `draftJson`), devuelve `{ documentId, draft, sourceLanguage, atsReport }`.
   - `GET /cv-import/:id` → `CvDocument` del usuario autenticado (404 si es de otro usuario o no existe) con su `draftJson`.
   - Crear `cv-import.module.ts` (importa `OpenaiModule`, usa `PrismaService`) y registrarlo en `app.module.ts`.
7. Extender `backend/src/profile/dto/profile.dto.ts`: `@IsEnum(Source)` opcional en `ProfileDto` y en cada DTO de item. En `profile.service.ts` `replaceForUser`, incluir `source` en los upserts/creaciones (default `USER` cuando el payload no lo trae). Actualizar el modelo de perfil en el frontend (`core/models/profile.ts`) con `source`.
8. Tests: unitarios `text-extractor.service.spec.ts` (PDF/DOCX con fixtures en `test/fixtures/`, texto vacío → 422), `ats-check.service.spec.ts`, `cv-parser.service.spec.ts` (OpenAI mockeado: respuesta válida, JSON inválido), `cv-import.service.spec.ts` (persiste documento, no expone docs ajenos). E2E `cv-import.e2e-spec.ts`: upload PDF válido → 200 con `draft` y `atsReport`; DOCX válido → 200; `.txt` → 400; PDF sin capa de texto → 422; `GET /cv-import/:id` del propio usuario → 200, de otro → 404; `PUT /profile` con `source: CV_IMPORT` persiste y el `source` sobrevive a un nuevo `GET /profile`.
9. Frontend: `CvImportService` (`upload(file)`, `getDocument(id)`). Página `/cv-import` protegida (SCSS del scaffold, sin librerías UI): widget de subida con drag/drop o input, tras el upload muestra el reporte ATS y el preview del borrador editable (reusando la misma estrategia de formularios/`FormArray` de `/profile`), botón "Confirmar y aplicar" que hace `PUT /profile` con el payload del borrador (items con `source: CV_IMPORT`; los que el usuario agregue a mano → `USER`). Si el usuario recarga a mitad de la revisión, recupera el borrador vía `GET /cv-import/:documentId`. Ruta registrada en `app.routes.ts` y enlace desde `dashboard.component`.
10. Verificación final: `npm run build:all`, `npm run lint:all`, `npm run test -w career-analyzer-backend`, y flujo manual en navegador (login → `/cv-import` → subir PDF → ver reporte y borrador → editar → confirmar → `/profile` refleja los datos con origen CV importado → recargar y verificar persistencia → subir `.txt` y ver error 400).

## Acceptance criteria

- [x] El enum `Source`, los campos `source` y el modelo `CvDocument` existen en `schema.prisma`; la migración `cv_import` está aplicada y el client regenerado.
- [x] `POST /cv-import` con PDF válido → 200/201 con `{ documentId, draft, sourceLanguage, atsReport }`; con DOCX válido → 200. La respuesta contiene solo datos presentes en el texto del CV (verificable comparando `draft` contra `extractedText`).
- [x] Mimetype no soportado (`.txt`, `.png`) → 400; PDF/DOCX sin texto extraíble → 422 con mensaje claro.
- [x] El modelo usado en el parseo es el de `OPENAI_MODEL` (default `gpt-4o-mini`); sin la variable, la app bootea con el default.
- [x] `CvDocument` se persiste con `storagePath`, `extractedText`, `sourceLanguage`, `model` y `draftJson`.
- [x] `GET /cv-import/:id` devuelve el documento del usuario autenticado; el de otro usuario → 404.
- [x] El borrador relaja campos obligatorios (`skill.level`, etc. pueden ser `null`); la confirmación vía `PUT /profile` rechaza payload inválido (400) y persiste items con `source: CV_IMPORT`.
- [x] Tras confirmar, `GET /profile` devuelve los items con su `source` (`CV_IMPORT` para lo importado, `USER` para lo agregado manualmente); repetir el `PUT` no duplica (sigue idempotente).
- [x] El reporte ATS tiene cheques booleanos concretos (`contact`, `headline`, `summary`, `experience`, `skills`, `education`, `languages`) con mensajes accionables.
- [x] `npm run build:all` y `npm run lint:all` OK; `npm run test -w career-analyzer-backend` pasa (unit + e2e).
- [x] `/cv-import` en el frontend sube el archivo, muestra el reporte y el preview editable, confirma aplicando a `/profile`, y recupera el borrador tras recargar con `GET /cv-import/:id`; sin sesión redirige a `/auth/login`.
- [x] Los archivos quedan en `backend/uploads/` (gitignored); no se usa `localStorage` para el perfil.

## Decisions

- **Sí:** dividir importación y exportación en dos specs (06 y 07). Son dos dominios; un solo spec violaba la regla de una frase-objetivo.
- **Sí:** flujo preview + edición + confirmación en lugar de aplicar directo. La IA no inventa (README); el dato jamás se persiste sin revisión humana.
- **Sí:** `source` por item (los 6 modelos + `Profile`) con enum `USER`/`CV_IMPORT`/`AI`, como dejó previsto SPEC 05. `AI` queda reservado para el futuro enriquecimiento.
- **Sí:** sin endpoint de "apply": el borrador confirmado se aplica con el `PUT /profile` existente, ampliado para `source`. Reusa el contrato agregado de SPEC 05 y evita duplicar semántica de persistencia.
- **Sí:** borrador con validación relajada (campos obligatorios nullable). Forzar niveles 1–5 o idiomas A1–C2 en el parseo obligaría a la IA a inventar valores que el CV no declara.
- **Sí:** `pdf-parse` + `mammoth` para extracción. Livianos, estándar, sin dependencias de binarios externos.
- **Sí:** `gpt-4o-mini` como default configurable (`OPENAI_MODEL`). Suficiente para parseo estructurado y barato; completa la configuración diferida en SPEC 03.
- **Sí:** structured outputs (JSON Schema) del SDK oficial. Contrato tipado con la forma del perfil, sin prompt-parsing manual.
- **Sí:** persistir archivo + texto + borrador en `CvDocument` con storage local gitignored. Permite auditoría, re-parseo y recuperación de revisión; objeto-storage queda para el spec de infraestructura.
- **No:** aplicar el borrador automáticamente, traducción al importar, enriquecimiento por IA (`AI`), OCR, merge multi-CV, optimización ATS por job — cada uno a su spec.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| PDF escaneado/sin capa de texto → extracción vacía | 422 con mensaje claro; OCR queda fuera del MVP (se evalúa como feature aparte). |
| La IA inventa datos no presentes en el CV | Prompt restrictivo + structured outputs + borrador relajado (null en vez de inventar) + gate humano de confirmación + `draftJson` auditable contra `extractedText`. |
| `pdf-parse` con APIs distintas según versión (v1 callback vs v2) | El paso 2 fija la versión y adapta el extractor a su API; test con fixture lo cubre. |
| Archivo grande o mimetype engañoso | Multer `limits: 10MB` y `fileFilter` por mimetype (400); el extractor valida el resultado. |
| Costo/calidad del modelo | Modelo configurable por env; default económico; el reporte ATS y el gate humano absorben imperfecciones. |
| Borrador con campos requeridos nulos bloqueando el PUT | El preview marca los campos faltantes (reporte ATS + validación del form) y el usuario los completa antes de confirmar. |

## What is **not** in this spec

- Exportación de CV en PDF/DOCX (spec 07).
- Enriquecimiento de datos faltantes con IA (valor `AI` de `source`).
- Traducción del CV al importar.
- OCR para PDFs escaneados.
- Merge o comparación de múltiples CVs.
- Almacenamiento en la nube / infraestructura de objetos.
- Optimización ATS con keywords por oferta (pertenece a la generación de CV).

Cada uno, si llega, tendrá su propio spec.
