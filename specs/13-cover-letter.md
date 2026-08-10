# SPEC 13 — Carta de motivación (cover letter)

> **Status:** Approved
> **Depends on:** SPEC 05, SPEC 07, SPEC 10, SPEC 11
> **Date:** 2026-08-09
> **Objective:** Generar, permitir editar antes de guardar, persistir con historial y exportar en PDF/DOCX una carta de motivación "medianamente completa" para una postulación concreta —derivada del Candidate Profile y de una `JobOffer` guardada, con nombre de recruiter y nota libre opcionales, en el idioma de la oferta y sin que la IA invente datos del perfil.

## Scope

**In:**

- Backend: modelo `CoverLetter` en Prisma (versión final persistida por usuario/oferta, historial append-only, snapshots y huella del perfil para auditoría y `stale`), con migración.
- Flujo de dos pasos "borrador editable → guardar" (el preview editable que SPEC 12 difirió a este spec):
  - **`POST /cover-letter/draft`** → body `{ jobOfferId, recruiterName?, note? }`. Carga la `JobOffer` (404 si no existe o no es del usuario); arma el snapshot/huella del perfil; llama a la IA; devuelve `{ content, sourceLanguage }` **sin persistir**.
  - **`POST /cover-letter`** → body `{ jobOfferId, recruiterName?, note?, content }`. Mismas validaciones de ownership; persiste la versión final con `profileSnapshot`, `offerSnapshot` y `profileFingerprint` → 201.
- Entradas:
  - **`jobOfferId`** (obligatorio): la oferta guardada aporta `title`, `company`, `level`, `responsibilities`, `requiredSkills`, `preferredSkills`, `experienceSummary` y `sourceLanguage`. La carta es para una postulación concreta (sin oferta no hay carta en este spec).
  - **`recruiterName`** (opcional): nombre para el saludo y el bloque de destinatario; si viene vacío → saludo genérico (`Estimado equipo de selección` / `Dear hiring team`).
  - **`note`** (opcional): texto libre del usuario (dónde vio la vacante, disponibilidad, aclaraciones) que la IA integra de forma natural si corresponde; nunca inventa lo que la nota no dice.
  - El **Candidate Profile siempre es la fuente**: los datos de experiencia/skills/proyectos/educación salen solo del perfil; jamás hay texto pegado de un CV externo.
- Generación con IA vía `OpenaiService` (SPEC 03) usando structured outputs. **Division de responsabilidades:**
  - **Determinista (sistema, no IA):** idioma de la carta (`lang` = `sourceLanguage` de la oferta si es `es`/`en`, si no `es`), fecha de la carta y firma (nombre y email del `User`), y asunto `Re: {title}` (+ ` — {company}` si existe) derivado del `offerSnapshot` al renderizar.
  - **La IA redacta el `content`** (saludo → párrafos → cierre) con estos bloques fijos:
    1. **Saludo**: con `recruiterName` si viene, si no genérico, en `lang`.
    2. **Apertura**: quién soy (headline o posición de la experiencia más reciente del perfil), a qué puesto (title de la oferta) y en qué empresa postulo; dónde vi la vacante solo si la `note` lo dice.
    3. **Por qué me interesa el puesto**: alineación con `responsibilities`/`requiredSkills`/`experienceSummary` de la oferta, desde lo que el perfil declara; sin afirmar skills que el perfil no tiene.
    4. **Por qué deberían contratarme**: experiencias, proyectos y `metrics` **reales del perfil**, alineados a la oferta; cuantifica solo con métricas declaradas.
    5. **Cierre/CTA**: agradecimiento y próximo paso proactivo; disponibilidad solo si consta en el perfil o la `note`.
    6. Línea de cierre ("Atentamente"/"Sincerely,") — el nombre se agrega determinista al renderizar.
- Garantía **no inventar** (invariante README): la IA solo recibe `profileSnapshot` + `offerSnapshot` + `recruiterName` + `note`; el prompt prohíbe afirmar empresas, posiciones, skills, logros, métricas, educación o proyectos que no estén en el snapshot; el **borrador nunca se persiste** hasta que el usuario lo edita y guarda (gate humano); `content` final queda auditable contra los snapshots (diff/revisión). No hay validación server-side de entidades citadas (decisión aprobada; el gate es prompt + snapshots + edición humana).
- Persistencia: `CoverLetter` por guardado (historial append-only). Algoritmo:
  - `POST /cover-letter/draft` → genera fresco, no persiste.
  - `POST /cover-letter` → persiste la versión final editada.
  - `GET /cover-letter/:id` → sirve el guardado; compara `profileFingerprint` actual y devuelve `stale: boolean` (si el perfil cambió). **No hay recompute**: para actualizar, se genera una carta nueva.
- Exportación: nuevos builders `buildLetterPdf`/`buildLetterDocx` en el módulo usando **pdfmake** y **docx** (mismas librerías y patrón `StreamableFile` de SPEC 07), con formato carta: fecha (en `lang`), asunto `Re: {title} — {company}`, `content` (con saltos de línea preservados) y firma `{name} — {email}`. Sin nuevas dependencias.
- API REST protegido por el guard global (SPEC 04):
  - `POST /cover-letter/draft` → `{ jobOfferId, recruiterName?, note? }`; valida ownership; no persiste → 200 con `{ content, sourceLanguage }`.
  - `POST /cover-letter` → `{ jobOfferId, recruiterName?, note?, content }`; `content` requerido y con límite; 404 si la oferta es ajena o inexistente → 201 con `CoverLetterDto`.
  - `GET /cover-letter` → historial del usuario (desc por `createdAt`).
  - `GET /cover-letter/:id` → versión del usuario (404 si es de otro o no existe); incluye `stale`.
  - `GET /cover-letter/:id/export?format=pdf|docx&lang?` → `StreamableFile`; `format` requerido (`@IsIn(['pdf','docx'])`); `lang` opcional (`@IsIn(['es','en'])`) para la fecha, **default = `sourceLanguage` si es `es`/`en`, si no `es`**.
  - `DELETE /cover-letter/:id` → borra la carta (no borra la oferta).
- Frontend:
  - `frontend/src/app/core/models/cover-letter.ts` (tipos `CoverLetterDto`, borrador) y `frontend/src/app/cover-letter/cover-letter.service.ts` (`draft(jobOfferId, recruiterName?, note?)`, `create(...)`, `list`, `get(id)`, `download(id, format, lang?)`, `delete(id)`).
  - Página `/cover-letter` (SCSS del scaffold, sin librerías UI): historial de cartas.
  - Página `/cover-letter/new?jobOfferId=X`: form con `recruiterName` y `note`, botón "Generar borrador" → `POST /cover-letter/draft` → textarea editable con el `content` → "Guardar carta" → `POST /cover-letter` → navega al detalle. Si falta `jobOfferId`, se pide elegir una oferta.
  - Detalle `/cover-letter/:id`: texto del `content`, etiqueta "Generada por IA (editada por ti)" si el usuario la modificó **o** versión conservada sin cambios, botones "Descargar PDF"/"Descargar DOCX", banner de `stale` con aviso "El perfil cambió desde esta carta: genera una nueva".
  - Botón **"Carta de motivación"** en el detalle de una oferta guardada en `/job-analysis` (SPEC 10) → navega a `/cover-letter/new?jobOfferId=<id>`.
- Tests: unitarios del parser (OpenAI mockeado: contenido en `lang` correcto, saludo con/sin recruiter, JSON inválido → 422), del service (draft no persiste, create persiste, snapshot/fingerprint, stale, ownership, export delega en el builder), de los builders PDF/DOCX (formato carta, fecha/asunto/firma, saltos de línea), y e2e del flujo completo.

**Out of scope (para specs futuros):**

- Carta genérica de motivación sin oferta guardada (siempre hay `jobOfferId`).
- Integración con los gaps del `JobMatch` (SPEC 11): aquí la honestidad la cubre el prompt + snapshot + edición humana, sin depender del match.
- Validación server-side de entidades citadas por la IA (empresas/skills fuera del snapshot → rechazo automático).
- Editor de la "cabecera" de la carta (fecha/asunto/firma son derivados, no editables) ni múltiples plantillas/estilos de carta.
- Borradores parciales guardados a mitad de edición (solo se persiste la versión final con `POST /cover-letter`).
- Envío de la carta por email/LinkedIn y adjuntos de la postulación.
- Traducción del `content` (la carta se genera en el idioma de la oferta; traducir luego es otro flujo).

## Data model

Agregar el modelo `CoverLetter` más las relaciones en `User` y `JobOffer`:

```prisma
model User {
  // ... campos de SPEC 04/05/10/11/12
  coverLetters CoverLetter[]
}

model JobOffer {
  // ... campos de SPEC 10
  coverLetters CoverLetter[]
}

model CoverLetter {
  id                 String   @id @default(cuid())
  userId             String
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  jobOfferId         String?
  jobOffer           JobOffer? @relation(fields: [jobOfferId], references: [id], onDelete: SetNull)
  recruiterName      String?
  note               String?  @db.Text
  sourceLanguage     String?
  content            String   @db.Text
  offerSnapshot      Json     // JobOffer usada al generar
  profileSnapshot    Json     // vista agregada del perfil usada al generar
  profileFingerprint String   // huella del perfil al momento de generar
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

Convenciones:

- `jobOfferId` **nullable** con `onDelete: SetNull` (patrón SPEC 12): borrar la oferta (SPEC 10) no borra las cartas (son deliverables del usuario).
- `content`: el texto completo de la carta desde el **saludo** hasta la **línea de cierre** ("Atentamente,") con saltos de línea. La fecha, el asunto `Re: {title} — {company}` y la firma `{name} — {email}` **no viven aquí**: se derivan de `offerSnapshot` y del `User` al renderizar/exportar.
- `sourceLanguage`: idioma de la carta (`es`/`en`), igual al de la oferta si es es/en, si no `es`.
- `recruiterName` y `note`: se guardan para auditoría y para mostrar/volver a editar; no se re-generan.
- `profileSnapshot`, `profileFingerprint` y el cálculo de `stale`: se **reutilizan** de `backend/src/job-match/profile-util.ts` (SPEC 11, exportados ya por SPEC 12). Sin código duplicado.
- Historial append-only: cada `POST /cover-letter` persiste una carta nueva; `GET`/export nunca disparan IA.

## Implementation plan

Cada paso deja el sistema compilable y funcionando.

1. En `backend/prisma/schema.prisma`: agregar el modelo `CoverLetter` y las relaciones `coverLetters` en `User` y `JobOffer`. Ejecutar `prisma migrate dev` (nombre `cover_letter`) y `prisma generate`.
2. Verificar que `backend/src/job-match/profile-util.ts` exporta `profileSnapshot` y `profileFingerprint` (SPEC 12 ya los usa; si no, exportarlos — único cambio de contrato).
3. Crear `backend/src/cover-letter/dto/cover-letter.dto.ts`:
   - `CreateCoverLetterDraftDto`: `jobOfferId` (`@IsString @IsNotEmpty`), `recruiterName?` (`@IsOptional @IsString @MaxLength(120)`), `note?` (`@IsOptional @IsString @MaxLength(2000)`).
   - `CreateCoverLetterDto`: extiende el draft + `content` (`@IsString @IsNotEmpty @MaxLength(20000)`).
   - `ExportQueryDto`: `format` (`@IsIn(['pdf','docx'])`), `lang?` (`@IsOptional @IsIn(['es','en'])`).
   - `CoverLetterDto`: `id`, `jobOfferId?`, `recruiterName?`, `note?`, `sourceLanguage`, `content`, `stale`, `createdAt`, `updatedAt`.
4. Crear `backend/src/cover-letter/cover-letter-parser.service.ts`: inyecta `OpenaiService`; método `generate({ profileSnapshot, offerSnapshot, recruiterName, note, lang })` → structured outputs con JSON Schema `{ content: string }`. Prompt (en `lang`): carta "medianamente completa" con saludo (recruiterName o genérico), apertura, "por qué me interesa el puesto", "por qué deberían contratarme" (solo datos reales del snapshot, cuantificar solo con `metrics` reales), cierre/CTA y línea de cierre; prosa natural y profesional, sin keyword stuffing; **prohibido** afirmar empresas, posiciones, skills, logros, educación o proyectos ausentes del snapshot; la `note` se integra de forma natural si corresponde (dónde vio la vacante, disponibilidad), nunca inventa lo que la nota no dice. Respuesta no JSON o forma inválida → `BadGatewayException`/422.
5. Crear `backend/src/cover-letter/cover-letter.service.ts`:
   - `buildDraft(userId, jobOfferId, recruiterName|null, note|null)`: carga la `JobOffer` (404 si no existe o es ajena); arma `profileSnapshot`/`profileFingerprint`; calcula `lang` desde `sourceLanguage`; llama al parser; devuelve `{ content, sourceLanguage }` sin persistir.
   - `create(userId, jobOfferId, recruiterName|null, note|null, content)`: mismas validaciones; persistie `CoverLetter` con snapshots/huella → carta.
   - `list(userId)` (desc por `createdAt`), `getById(userId, id)` con `stale` (huella actual vs guardada), `delete(userId, id)`; ownership → 404.
   - `exportLetter(userId, id, format, lang)`: carga la carta, arma el documento (fecha en `lang`, asunto `Re: {title} — {company}` del `offerSnapshot` si `company` existe, `content`, firma `name — email` del `User`), delega en `CoverLetterDocumentService.buildPdf/buildDocx`.
6. Crear `backend/src/cover-letter/cover-letter-document.service.ts` (pdfmake + docx, patrón SPEC 07): formato carta A4, una columna; `buildLetterPdf(doc, lang)` y `buildLetterDocx(doc, lang)` → `Buffer`; fecha localizada (`lang`), asunto, texto del `content` respetando saltos de línea, firma. Sin librerías nuevas.
7. Crear `backend/src/cover-letter/cover-letter.controller.ts` y `cover-letter.module.ts` (importa `PrismaService`; `OpenaiModule` es global); registrarlo en `app.module.ts`:
   - `POST /cover-letter/draft` → 200 con `{ content, sourceLanguage }`.
   - `POST /cover-letter` → 201 con `CoverLetterDto`.
   - `GET /cover-letter` → historial.
   - `GET /cover-letter/:id` → detalle con `stale`.
   - `GET /cover-letter/:id/export?format=pdf|docx&lang?` → `StreamableFile` (mismo patrón SPEC 07; `lang` default = `sourceLanguage` es/en, si no `es`).
   - `DELETE /cover-letter/:id` → borra la carta.
8. Tests: `cover-letter-parser.service.spec.ts` (OpenAI mockeado: genera `content` en `lang` correcto, saludo con recruiter y genérico, nota integrada, JSON inválido → 422), `cover-letter.service.spec.ts` (draft no persiste; create persiste con snapshots; stub `stale` refleja huella; ownership → 404; export arma documento y delega en el builder), `cover-letter-document.service.spec.ts` (PDF `%PDF`, DOCX `PK`, contiene fecha/asunto/content/firma, saltos de línea preservados), e2e `cover-letter.e2e-spec.ts` (401 sin cookie; draft sin `jobOfferId` → 400; oferta ajena/inexistente → 404; draft → 200 y **no** aparece en `GET /cover-letter`; create con `content` → 201 y persiste; create sin `content` → 400; `GET /cover-letter` solo propias; get/export/delete de carta ajena → 404; export pdf → 200 `%PDF` con texto extraído (`pdf-parse`) que incluye asunto y `content`; export docx → 200 con texto equivalente (`mammoth`); `DELETE` no borra la oferta).
9. Frontend: `frontend/src/app/core/models/cover-letter.ts` (tipos `CoverLetterDto`) y `frontend/src/app/cover-letter/cover-letter.service.ts` (`draft(jobOfferId, recruiterName?, note?)`, `create(jobOfferId, recruiterName?, note?, content)`, `list`, `get(id)`, `download(id, format, lang?)`, `delete(id)`).
10. Frontend UI: páginas standalone `cover-letter.component` (historial), `cover-letter-new.component` (form + generación + textarea editable + guardar) y `cover-letter-detail.component` (texto, descargas, `stale`, borrar). Rutas `/cover-letter`, `/cover-letter/new`, `/cover-letter/:id` protegidas en `app.routes.ts`; enlace desde el dashboard y botón "Carta de motivación" en el detalle de oferta de `/job-analysis` → `/cover-letter/new?jobOfferId=<id>`.
11. Verificación final: `npm run build:all`, `npm run lint:all`, `npm run test -w career-analyzer-backend`, y flujo manual (login → `/job-analysis` con una oferta guardada en inglés → "Carta de motivación" → completar `recruiterName` y `note` → "Generar borrador" → ver la carta en inglés con saludo personalizado → editar el texto → "Guardar carta" → ver el detalle → descargar PDF/DOCX y revisar fecha, asunto, contenido y firma → editar un skill del perfil → volver a la carta → banner de `stale` → generar una carta nueva → ver ambas en el historial → borrar una carta → la oferta sigue).

## Acceptance criteria

- [ ] El modelo `CoverLetter` existe en `schema.prisma` con `jobOfferId` nullable y `onDelete: SetNull`; la migración `cover_letter` está aplicada y el client regenerado.
- [ ] `POST /cover-letter/draft` con `jobOfferId` de una oferta del usuario → 200 con `{ content, sourceLanguage }` y **no persiste** (nada aparece en `GET /cover-letter`); oferta ajena/inexistente → 404; sin `jobOfferId` → 400.
- [ ] `POST /cover-letter` con `content` no vacío → 201 y persiste; sin `content` → 400; `content` > 20.000 chars → 400; oferta ajena/inexistente → 404.
- [ ] El `content` está en el idioma `sourceLanguage` de la oferta (si es es/en) y el saludo usa `recruiterName` cuando viene y el genérico/localizado (`Dear hiring team` / `Estimado equipo de selección`) cuando no.
- [ ] El `content` no afirma ninguna empresa, posición, skill, logro, métrica, educación o proyecto ausente del `profileSnapshot` (revisable por diff `content` vs `profileSnapshot` + `offerSnapshot` + `note`); el `draft` nunca se persiste sin edición humana previa.
- [ ] `GET /cover-letter/:id` sirve el guardado e incluye `stale` correcto (huella del perfil); `GET /cover-letter` devuelve solo cartas del usuario; `GET/export/DELETE` de una carta ajena o inexistente → 404.
- [ ] `GET /cover-letter/:id/export?format=pdf` → 200, `Content-Type: application/pdf`, body `%PDF` con texto extraído (`pdf-parse`) que incluye asunto `Re: {title}`, el `content` y la firma; `format=docx` → 200 con texto equivalente (`mammoth`); `format` inválido → 400.
- [ ] La fecha de la carta y el asunto se derivan de `offerSnapshot`/fecha actual y la firma del `User` (no del `content`); `lang=es`/`lang=en` cambia la localización de la fecha.
- [ ] `DELETE /cover-letter/:id` borra la carta y **no** borra la oferta.
- [ ] `npm run build:all` y `npm run lint:all` OK; `npm run test -w career-analyzer-backend` pasa (unit + e2e).
- [ ] Frontend: botón "Carta de motivación" por oferta en `/job-analysis`; flujo generador → editable → guardar → detalle; descargas PDF/DOCX; banner de `stale`; historial en `/cover-letter`; sin sesión redirige a `/auth/login`.
- [ ] No se usa `localStorage` para cartas; todo viaja por la API.

## Decisions

- **Sí:** flujo **borrador editable → guardar**. SPEC 12 difirió el "preview editable" a este spec; un `draft` sin persistir + `POST /cover-letter` con el texto final (patrón SPEC 10: `analyze` → preview → persistir) da el gate humano exacto donde la invariante lo pide: lo que se persiste ya fue leído/editado por el usuario.
- **Sí:** carta **persistida** (`CoverLetter`) con historial append-only, `offerSnapshot`, `profileSnapshot` y `profileFingerprint` con `stale` (reutiliza el patrón y las utilidades de SPEC 11/12). Una carta es un deliverable de la postulación que se guarda, consulta y exporta sin re-pagar IA.
- **Sí:** fuentes = **perfil + oferta guardada + nota libre**; `recruiterName` opcional al generar (saludo genérico si vacío) y `note` libre como campo único (dónde vio la vacante, disponibilidad, etc.). Elimina campos de entrada ad-hoc y mantiene la fuente de verdad: todo lo factual nace del perfil y de la oferta.
- **Sí:** idioma de la carta = **idioma de la oferta** (sourceLanguage es/en, default `es`). Se postula en el idioma de la vacante (caso de uso confirmado por el usuario; coherente con la invariante de traducción natural y con SPEC 12).
- **Sí:** estructura **fija determinista**: fecha, asunto `Re: {title} — {company}` y firma derivados del sistema; la IA redacta solo el `content` (saludo→cierre) con bloques fijos ("por qué me interesa", "por qué deberían contratarme"). Mantiene la carta "medianamente completa" que pidió el usuario sin dar a la IA control sobre datos de identificación.
- **Sí:** exportación **PDF y DOCX** con pdfmake/docx y patrón `StreamableFile` (SPEC 07), sin librerías nuevas ni plantillas adicionales.
- **Sí:** gate de "no inventar" = **prompt restringido + snapshots auditable + edición humana antes de guardar**. El usuario descartó la validación server-side de entidades citadas: la prosa libre no se presta a un parseo fiable y el gate humano ya garantiza que no se persista una invención.
- **No:** carta genérica sin oferta, integración con gaps del `JobMatch` (aquí la honestidad la cubren prompt + snapshot + gate humano), validación automática de entidades, edición de cabecera/firma, borradores parciales, múltiples plantillas, envío por email/LinkedIn — cada uno a su spec.
- **No:** librerías UI nuevas; SCSS del scaffold (patrón del resto de specs).

## Risks

| Riesgo | Mitigación |
| --- | --- |
| La IA inventa empresa/posición/skill/logro o exagera métricas | La IA solo ve `profileSnapshot`+`offerSnapshot`+`note`; el prompt prohíbe afirmar lo ausente del snapshot; el borrador no se persiste hasta la edición humana; snapshots guardados para auditoría. |
| La IA afirma un skill que la oferta pide y el perfil no tiene | El prompt instruye no declarar skills ausentes del perfil; sin match de gaps, la honestidad recae en el prompt + snapshot + gate humano (decisión aprobada). |
| La carta sale en otro idioma o con saludo incorrecto | `lang` calculado server-side desde `sourceLanguage`; saludo condicionado por `recruiterName`; tests unitarios del parser lo verifican. |
| Keyword stuffing al alinear con la oferta | Prompt de prosa natural/profesional; e2e revisa contra prompt; el borrador editable permite al usuario corregir. |
| El perfil cambia tras la generación | `profileFingerprint` al guardar; `GET` compara y devuelve `stale`; la UI invita a generar una carta nueva. |
| Borrar la oferta rompe la carta | `onDelete: SetNull` + `content` autocontenido y `offerSnapshot` para asunto/fecha; la carta sigue legible y exportable. |
| `note` enorme o `content` gigante | `@MaxLength` en DTOs (2000 y 20000); el texto viaja al prompt con límites. |
| Costo de las llamadas de IA | IA solo en `POST /cover-letter/draft` y `POST /cover-letter`; `GET`/export/historial nunca disparan la API. |
| ATS lee la carta como imagen en PDF | PDF con texto real seleccionable (pdfmake), verificado con `pdf-parse`; formato carta de una columna. |

## What is **not** in this spec

- Carta genérica de motivación sin oferta guardada.
- Integración con gaps del `JobMatch` (SPEC 11).
- Validación server-side de entidades citadas por la IA.
- Editor de fecha/asunto/firma ni múltiples plantillas de carta.
- Borradores parciales guardados a mitad de edición.
- Envío de la carta por email/LinkedIn ni adjuntos de postulación.
- Traducción posterior del `content` a otro idioma.

Cada uno, si llega, tendrá su propio spec.