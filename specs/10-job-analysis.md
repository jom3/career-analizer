# SPEC 10 — Análisis de ofertas de trabajo

> **Status:** Approved
> **Depends on:** SPEC 03, SPEC 05, SPEC 06
> **Date:** 2026-08-09
> **Objective:** Analizar una oferta de trabajo —ingresada como texto pegado, imagen copiada/subida o PDF— con la API de OpenAI, estructurarla en un esquema fijo y persistirla como historial por usuario, con preview editable antes de guardar y sin incluir el matching con el perfil.

## Scope

**In:**

- Backend: modelo `JobOffer` en Prisma (campos estructurados, enum de nivel, historial por usuario) + relación en `User`, con migración.
- Entrada flexible de la oferta, un solo endpoint `POST /job-analysis/analyze`:
  - Texto pegado.
  - Imagen copiada al portapapeles o subida como archivo → modelo con visión de OpenAI (se envía la imagen base64 en el mismo call).
  - PDF subido (y DOCX) → reutiliza el extractor de texto de SPEC 06 (`text-extractor.service`) y luego parsea el texto.
- Parseo con IA vía `OpenaiService` (SPEC 03) usando **structured outputs** (JSON Schema), modelo `OPENAI_MODEL` (SPEC 06, default `gpt-4o-mini`, que soporta visión). El resultado es un **borrador** con la forma de la oferta; solo extrae datos presentes en la fuente y deja `null` lo incierto (no inventa).
- Esquema del análisis (claves en inglés; contenido en el idioma de la oferta):
  - `title`, `company`, `level` (enum `Junior`/`Mid`/`Senior`/`Lead`/`Executive`, `null` si la oferta no lo declara), `responsibilities[]`, `requiredSkills[]`, `preferredSkills[]`, `experienceYears` (número opcional), `experienceSummary` (texto tal cual), `education[]`, `languages[]`, `keywords[]`.
- Detección del idioma de la oferta (`sourceLanguage`).
- API REST protegido por el guard global (cookie, SPEC 04):
  - `POST /job-analysis/analyze` (multipart) → devuelve `{ draft, sourceLanguage }` **sin persistir**.
  - `POST /job-analysis` → persiste el borrador confirmado/editado → `JobOffer`.
  - `GET /job-analysis` → historial del usuario (desc por `createdAt`).
  - `GET /job-analysis/:id` → oferta del usuario autenticado (404 si es de otro o no existe).
  - `PUT /job-analysis/:id` → edita una oferta guardada.
  - `DELETE /job-analysis/:id` → borra una oferta guardada.
- Auditoría: para texto y PDF se persiste `rawInput` (texto/extracción usados). Las imágenes **no se conservan**: el archivo solo impulsa el análisis y se descarta; `rawInput` queda `null`.
- Frontend: página `/job-analysis` protegida (SCSS del scaffold, sin librerías UI) con zona de entrada flexible, preview editable del borrador antes de guardar, e historial de ofertas guardadas debajo (ver/editar/borrar).
- Tests: unitarios del parser (OpenAI mockeado: texto, imagen, JSON inválido), del service (persiste, no expone ofertas ajenas), y e2e del flujo completo.

**Out of scope (para specs futuros):**

- Matching candidato↔oferta (feature MVP aparte, según el README).
- Skill gaps, recomendaciones o CV adaptado a la oferta.
- Integración con LinkedIn o scraping automático de URLs.
- Comparación o merge entre ofertas.
- Re-análisis automático de una oferta guardada (se puede re-analizar manualmente pegando de nuevo).
- Almacenamiento de objetos (S3/cloud); se mantiene el storage local de SPEC 06.

## Data model

Agregar los enums `JobLevel` e `InputType` y el modelo `JobOffer`, más la relación en `User`:

```prisma
enum JobLevel {
  Junior
  Mid
  Senior
  Lead
  Executive
}

enum InputType {
  TEXT
  PDF
  IMAGE
}

model User {
  // ... campos de SPEC 04/05/06
  jobOffers JobOffer[]
}

model JobOffer {
  id               String    @id @default(cuid())
  userId           String
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  title            String
  company          String?
  level            JobLevel?
  responsibilities String[]
  requiredSkills   String[]
  preferredSkills  String[]
  experienceYears  Int?
  experienceSummary String?  @db.Text
  education        String[]
  languages        String[]
  keywords         String[]
  sourceLanguage   String?
  inputType        InputType @default(TEXT)
  rawInput         String?   @db.Text
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}
```

Convenciones:

- `level`: enum fijo normalizado; `null` cuando la oferta no indica nivel (la IA no lo infiere).
- `requiredSkills` vs `preferredSkills`: el parser separa lo que la oferta pide como obligatorio ("requisitos") de lo deseable ("deseable"/"nice to have"). Cuando la oferta no distingue, todo va a `requiredSkills`.
- `experienceYears`: número opcional si la oferta lo declara ("5+ años"); `experienceSummary` conserva el texto tal cual.
- `rawInput`: texto original (o extraído) que sirvió de fuente, para auditoría. Las imágenes → `null` (el archivo se descarta tras el análisis).
- Los campos de lista son arrays de strings sin orden garantizado; el frontend los muestra en el orden que devuelve la IA.

## Implementation plan

Cada paso deja el sistema compilable y funcionando.

1. En `backend/prisma/schema.prisma`: agregar los enums `JobLevel` e `InputType`, el modelo `JobOffer` y la relación `jobOffers` en `User`. Ejecutar `prisma migrate dev` (nombre `job_offer`) y `prisma generate`.
2. Crear `backend/src/job-analysis/dto/job-offer.dto.ts`: `JobOfferDto` con `title` (`@IsString @IsNotEmpty`), `company?`, `level?` (`@IsOptional @IsEnum(JobLevel)`), arrays de strings opcionales (`responsibilities`, `requiredSkills`, `preferredSkills`, `education`, `languages`, `keywords`), `experienceYears?` (`@IsOptional @IsInt @Min(0) @Max(50)`), `experienceSummary?`, `sourceLanguage?`, `inputType` (`@IsEnum(InputType)`).
3. Crear `backend/src/job-analysis/job-parser.service.ts`: inyecta `OpenaiService`; dos métodos con el mismo JSON Schema (structured outputs):
   - `parseText(text)`: mensaje con el texto y el prompt que instruye extraer solo datos presentes, `null` lo incierto, responder en el idioma de la oferta y devolver `level: null` si no se declara.
   - `parseImage(buffer, mimeType)`: mismo prompt pero con la imagen como content part base64 (visión).
   - Ambos detectan `sourceLanguage` y devuelven `{ draft, sourceLanguage }`. Respuesta no JSON o forma inválida → `BadGatewayException`/422 con mensaje de reintento.
4. Crear `backend/src/job-analysis/job-analysis.service.ts` y `job-analysis.controller.ts`:
   - `POST /job-analysis/analyze` (multipart: campo opcional `text`, campo opcional `file`; `FileInterceptor` con `memoryStorage`, límites de 10MB):
     - solo `text` → `parseText`.
     - `file` de imagen (`image/*`) → `parseImage`; la imagen **no se persiste**, solo impulsa el análisis.
     - `file` PDF/DOCX → extrae texto con el `TextExtractorService` de SPEC 06 y luego `parseText`.
     - ni `text` ni `file`, o ambos → 400.
     - devuelve `{ draft, sourceLanguage }` sin persistir.
   - `POST /job-analysis` → valida `JobOfferDto` y persiste → `JobOffer`.
   - `GET /job-analysis`, `GET /job-analysis/:id`, `PUT /job-analysis/:id`, `DELETE /job-analysis/:id`, siempre sobre el `userId` del request; ids de otro usuario → 404.
   - Crear `job-analysis.module.ts` (importa `OpenaiModule`, `CvImportModule` para reusar el extractor —o lo exporta—, usa `PrismaService`) y registrarlo en `app.module.ts`. Si `TextExtractorService` no está exportado desde `CvImportModule`, exportarlo (único cambio de contrato en SPEC 06).
5. Tests: unitarios `job-parser.service.spec.ts` (OpenAI mockeado: texto → draft válido, imagen → draft, JSON inválido → error), `job-analysis.service.spec.ts` (persiste, filtra por userId, no expone ofertas ajenas). E2E `job-analysis.e2e-spec.ts`: `analyze` con texto → 200 con `draft`; con imagen (fixture PNG) → 200; con PDF (fixture de SPEC 06) → 200; sin entrada → 400; `POST /job-analysis` → 201 y persiste; DTO inválido (sin `title`) → 400; `GET /job-analysis` → historial propio; `GET/PUT/DELETE` de oferta ajena → 404.
6. Frontend: `frontend/src/app/job-analysis/job-analysis.service.ts` (`analyze(text|file)`, `create`, `list`, `get`, `update`, `delete`). Página `job-analysis.component` standalone (SCSS del scaffold): zona de entrada con textarea, botón pegar imagen (clipboard), input para subir imagen y otro para PDF; tras `analyze` muestra el preview editable (campos del esquema, `FormArray` para listas) con botón "Guardar" → `POST /job-analysis`; debajo, historial con ver/editar/borrar. Ruta `/job-analysis` protegida en `app.routes.ts`; enlace desde `dashboard.component`.
7. Verificación final: `npm run build:all`, `npm run lint:all`, `npm run test -w career-analyzer-backend`, y flujo manual (login → `/job-analysis` → pegar texto → ver borrador → editar → guardar → aparece en historial → recargar y verificar persistencia → subir una captura PNG y un PDF → ambos se analizan → borrar una oferta).

## Acceptance criteria

- [ ] Los enums `JobLevel` e `InputType` y el modelo `JobOffer` existen en `schema.prisma`; la migración `job_offer` está aplicada y el client regenerado.
- [ ] `POST /job-analysis/analyze` con texto → 200 con `{ draft, sourceLanguage }`; no persiste nada (no aparece en `GET /job-analysis`).
- [ ] `POST /job-analysis/analyze` con imagen (copia o subida) y con PDF/DOCX → 200 con el mismo contrato; sin `text` ni `file` → 400.
- [ ] El borrador solo contiene datos presentes en la fuente (verificable comparando `draft` contra `rawInput`/texto extraído); `level` es `null` cuando la oferta no lo declara.
- [ ] Las claves del esquema son fijas (`title`, `company`, `level`, `responsibilities`, `requiredSkills`, `preferredSkills`, `experienceYears`, `experienceSummary`, `education`, `languages`, `keywords`); el contenido de los textos queda en el idioma de la oferta.
- [ ] `POST /job-analysis` persiste con validación estricta: sin `title` → 400; `level` inválido → 400; `experienceYears` fuera de 0–50 → 400.
- [ ] `GET /job-analysis` devuelve solo el historial del usuario autenticado; `GET/PUT/DELETE /job-analysis/:id` de una oferta ajena o inexistente → 404.
- [ ] Para texto/PDF, la oferta guardada incluye `rawInput`; para imágenes `rawInput` es `null` y **no queda ningún archivo en disco** (la imagen solo impulsa el análisis).
- [ ] `npm run build:all` y `npm run lint:all` OK; `npm run test -w career-analyzer-backend` pasa (unit + e2e).
- [ ] `/job-analysis` en el frontend ingresa por las 4 vías, muestra preview editable, guarda con confirmación y refleja la oferta en el historial; sin sesión redirige a `/auth/login`.
- [ ] No se usa `localStorage` para ofertas; todo viaja por la API.

## Decisions

- **Sí:** entrada flexible (texto, imagen copiada/subida, PDF/DOCX) en un solo endpoint `analyze`. El usuario pidió explícitamente las 4 vías; un endpoint multipart las cubre sin duplicar controladores.
- **Sí:** imágenes con modelo de visión (imagen base64 en el mismo call), en lugar de OCR local. `gpt-4o-mini` (default de `OPENAI_MODEL`, SPEC 06) soporta visión; sin librerías nuevas y mejor calidad en capturas de pantalla.
- **Sí:** persistir `JobOffer` en BD. El usuario lo eligió: habilita historial y el futuro spec de matching reutiliza la oferta ya estructurada sin re-analizar.
- **Sí:** solo análisis, sin matching. El README lista matching como feature MVP aparte; mezclarlo rompía el objetivo de una frase.
- **Sí:** contenido en el idioma de la oferta (con `sourceLanguage`). Coherente con la invariante de traducción natural; las claves del esquema siempre en inglés (contrato estable).
- **Sí:** `level` como enum fijo (`Junior`/`Mid`/`Senior`/`Lead`/`Executive`) con `null` cuando no se declara. Normalizado para filtros y matching futuro; la IA no infiere el nivel.
- **Sí:** experiencia y educación semi-estructuradas (`experienceYears` + `experienceSummary` + `education[]`). Estructura donde sirve y texto fiel donde la oferta es libre; evita que la IA invente campos profundos.
- **Sí:** preview editable antes de guardar. Replica el gate humano de SPEC 06: nada se persiste sin revisión del usuario.
- **Sí:** página dedicada `/job-analysis`. El usuario lo eligió sobre el widget del dashboard.
- **Sí:** reutilizar `OpenaiService` (SPEC 03) y `TextExtractorService` (SPEC 06). Sin código duplicado; el único cambio de contrato es exportar el extractor si `CvImportModule` no lo expone.
- **Sí:** `rawInput` para auditoría en texto/PDF. Permite verificar que la IA no inventó. Las imágenes **no se conservan** (decisión del usuario): el archivo solo impulsa el análisis y se descarta; no se persiste el binario ni `storagePath`.
- **No:** matching, skill gaps, LinkedIn/scraping, comparación entre ofertas, objeto-storage, re-análisis automático — cada uno a su spec.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| `OPENAI_MODEL` configurado a un modelo sin visión rompe el análisis de imágenes | Se documenta que las imágenes requieren un modelo con visión; el default `gpt-4o-mini` lo soporta. Si falla, el error 422 con mensaje claro invita a pegar el texto. |
| La IA "rellena" campos no presentes en la oferta | Prompt restrictivo + structured outputs + borrador relajado (`null` en lo incierto) + preview editable + `rawInput` auditable contra el borrador (texto/PDF). |
| La IA no distingue skills requeridos vs preferidos | Regla en el prompt: cuando la oferta no los separa, todo va a `requiredSkills`; el usuario edita el borrador antes de guardar. |
| Archivo grande o mimetype engañoso en `analyze` | Multer `limits: 10MB` y `fileFilter` (imagen o PDF/DOCX) → 400; el extractor valida el texto extraído (422 si es vacío). |
| Costo de las llamadas con visión | Modelo configurable; default económico; la oferta se analiza a demanda, no en segundo plano. |
| Imagen con texto ilegible (captura borrosa) | El preview editable absorbe imperfecciones; el usuario corrige antes de guardar. |

## What is **not** in this spec

- Matching candidato↔oferta y skill gaps.
- CV adaptado a la oferta (keywords, tailoring).
- Integración con LinkedIn o scraping de URLs.
- Comparación o merge entre ofertas.
- Re-análisis automático de ofertas guardadas.
- Almacenamiento de objetos en la nube.

Cada uno, si llega, tendrá su propio spec.
