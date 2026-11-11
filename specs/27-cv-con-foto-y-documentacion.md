# SPEC 27 — CV con foto y CV documentado

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 09
> **Date:** 2026-11-09
> **Objective:** Agregar dos documentos derivados del Candidate Profile, independientes del CV ATS (SPEC 07/09): (1) un CV con foto con el diseño de referencia del usuario, y (2) un CV documentado que es el CV con foto más los títulos y certificados adjuntos como anexos. Ambos en DOCX y PDF. La foto y los archivos se suben una sola vez, se guardan en el servidor y se reutilizan en cada generación.

## Scope

**In:**

- Backend, base de datos:
  - `Profile`: `photoPath String?`, `photoMimeType String?`.
  - `Education` y `Certification`: `documentPath String?`, `documentMimeType String?`, `documentName String?`, `showInCompactCv Boolean @default(true)`, `showInDocumentedCv Boolean @default(true)`.
- Backend, almacenamiento de archivos del perfil (disco, carpeta `uploads/profile/`, nombre aleatorio generado en servidor).
- Backend, endpoints de archivos:
  - `PUT /profile/photo`, `GET /profile/photo`, `DELETE /profile/photo` (multipart, campo `file`).
  - `PUT /profile/education/:id/document`, `GET /profile/education/:id/document`, `DELETE /profile/education/:id/document`.
  - `PUT /profile/certifications/:id/document`, `GET /profile/certifications/:id/document`, `DELETE /profile/certifications/:id/document`.
- Backend, generación:
  - `GET /cv-photo?format=pdf|docx&lang=es|en`: CV con foto (plantilla de referencia).
  - `GET /cv-documented?format=pdf|docx&lang=es|en`: CV con foto más anexos.
- Frontend `/profile`:
  - Sección de foto: subir, reemplazar, borrar, previsualizar.
  - Por título y certificado: adjuntar o reemplazar archivo, borrar archivo, y dos checks: "Mostrar en CV compacto" y "Mostrar en CV documentado".
  - Botones de generación: "Generar CV con foto" y "Generar CV documentado", cada uno con formato PDF y DOCX. Mientras genera, el botón muestra una animación de carga.
- Frontend: claves de i18n en `es.ts` y `en.ts`.
- Dependencias backend nuevas: `pdf-lib` (unir PDFs y páginas), `pdfjs-dist` + `@napi-rs/canvas` (rasterizar páginas PDF para el DOCX), `image-size` (dimensiones de imagen para el DOCX). Se verifica que `@napi-rs/canvas` funcione en la imagen Alpine del backend.
- Tests: unitarios de los servicios nuevos y e2e de los endpoints.

**Out of scope (para specs futuros):**

- Recorte o edición de la foto en la app (se sube lista).
- Nacionalidad y otros datos personales nuevos (se quitan del diseño).
- Compresión o conversión de PDFs de certificados.
- OCR o verificación de la validez de certificados.
- Traducción del contenido de los certificados (los nombres se muestran como están guardados).
- Varias fotos por perfil.
- Links públicos a documentos o CVs.
- Cambios en el CV ATS más allá del filtro `showInCompactCv` (SPEC 07 y 09 siguen vigentes).

## Data model

Campos nuevos en `backend/prisma/schema.prisma`:

```prisma
model Profile {
  // ... campos existentes
  photoPath     String?
  photoMimeType String?
}

model Education {
  // ... campos existentes
  documentPath      String?
  documentMimeType  String?
  documentName      String?
  showInCompactCv   Boolean @default(true)
  showInDocumentedCv Boolean @default(true)
}

model Certification {
  // ... campos existentes
  documentPath      String?
  documentMimeType  String?
  documentName      String?
  showInCompactCv   Boolean @default(true)
  showInDocumentedCv Boolean @default(true)
}
```

Convenciones:

- `photoPath`, `documentPath`: ruta relativa a la raíz de `backend/` (ej. `uploads/profile/3f2a...jpg`). Siempre la genera el servidor; nunca viene del cliente.
- `documentName`: nombre original del archivo, solo para mostrar en la UI.
- Los archivos son fuente de verdad del usuario, no contenido de IA. Nunca se modifican ni se reescriben.
- `showInCompactCv`: controla la aparición en el CV con foto (sección de certificados y formación) y en el CV ATS.
- `showInDocumentedCv`: controla la aparición en el CV documentado (lista y anexo).
- Los flags no afectan al perfil ni a otros documentos.

## Storage

- Carpeta: `backend/uploads/profile/`. Se crea recursivamente si no existe.
- Nombre de archivo: `<randomUUID>.<ext>`, con `ext` derivada del tipo validado (`jpg`, `png`, `pdf`).
- Validación por magic bytes, no por el `mimetype` declarado:
  - JPG: `FF D8 FF`.
  - PNG: `89 50 4E 47 0D 0A 1A 0A`.
  - PDF: `%PDF-`.
- Límite de tamaño: **10 MB por archivo** (foto, título o certificado).
- Los PDF se cargan con `pdf-lib` al subir. Si están cifrados o no se pueden leer, se rechazan con 400.
- Las imágenes se leen con `image-size` al subir. Si no tienen dimensiones válidas, se rechazan con 400.
- Subida con `memoryStorage` de Multer: el buffer se valida antes de escribir en disco. Un archivo inválido nunca llega al disco.
- Al reemplazar o borrar un archivo, el archivo anterior se elimina del disco.
- Al borrar un título o certificado (`PUT /profile` que lo quita), o un perfil completo, su archivo se elimina del disco.
- Lectura: el servidor resuelve la ruta a partir de la columna de la base y verifica que quede dentro de `uploads/profile/`. Las respuestas llevan `Cache-Control: private, no-store` y `X-Content-Type-Options: nosniff`.

## Generación

### CV con foto (`GET /cv-photo`)

- Usa el diseño de referencia (franja azul con foto a la izquierda, dos columnas, habilidades e idiomas con barras, fechas en formato corto en español o inglés, sección "Datos personales" solo con página web y LinkedIn).
- Filtra certificados y formación por `showInCompactCv`.
- Datos del perfil: el mismo `loadCvData` de SPEC 07, con los campos nuevos que se agregan en este spec.
- Barras de nivel:
  - Habilidades: `level / 5`.
  - Idiomas (CEFR): `A1=1, A2=2, B1=3, B2=4, C1=5, C2=6`, sobre una escala de 6.
- Fechas: `ene 2014 - ene 2022` en español, `Jan 2014 - Jan 2022` en inglés. `current` muestra `Actualidad` / `Present`.
- Títulos de sección según `lang`: Perfil/Profile, Formación/Education, Experiencia/Experience, Certificaciones/Certifications, Logros/Achievements (proyectos), Datos personales/Personal details, Habilidades/Skills, Idiomas/Languages.
- Si el perfil no tiene foto, el documento se genera sin foto (la franja se mantiene con el nombre y el contacto).
- PDF: `pdfmake`, con la foto como imagen en `images` (data URL). Texto real seleccionable.
- DOCX: `docx`, con `ImageRun` para la foto (tamaño calculado con `image-size`) y tablas o párrafos con sombreado para la franja y las columnas.
- Sin IA. No inventa datos ni métricas; solo renderiza lo que el perfil contiene.

### CV documentado (`GET /cv-documented`)

- Primera parte: el mismo CV con foto, con las mismas secciones, pero filtrando por `showInDocumentedCv`.
- Anexos: un anexo por cada título o certificado con archivo y `showInDocumentedCv = true`, en el orden de `sortOrder` (primero formación, luego certificados).
- Sin páginas separadoras. Cada hoja de anexo tiene, en la parte superior, la etiqueta de sección (`Certificados y títulos` / `Certificates and degrees`), el nombre del título o certificado y, debajo, emisor o institución y año si los tiene. El documento escalado ocupa el resto de la hoja.
- Un título o certificado con varias páginas (PDF) genera una hoja por página, cada una con la misma cabecera.
- Orientación: si el documento es vertical, la hoja es A4 vertical y el documento ocupa el ancho. Si es horizontal, la hoja es A4 horizontal (en PDF, la página cambia de tamaño; en DOCX, cada anexo horizontal es una sección con orientación horizontal).
- Certificados sin archivo aparecen en la lista de certificaciones del documento, pero no generan anexo.
- Anexos en **PDF**:
  - Las páginas del PDF se incrustan con `pdf-lib` (`embedPages`) y se dibujan escaladas bajo la cabecera, sin rasterizar.
  - Las imágenes (JPG/PNG) se incrustan y se dibujan escaladas bajo la cabecera.
- Anexos en **DOCX**:
  - Cada página de un PDF se rasteriza a JPEG (150 DPI, calidad 85) con `pdfjs-dist` + `@napi-rs/canvas`. Cada hoja es una sección propia con su cabecera y su imagen ajustada al espacio disponible.
  - Las imágenes se insertan directamente con el mismo esquema.
- Límites de generación: máximo **30 anexos** y **40 MB** en total de archivos anexados. Si se supera, responde 400 con código `TOO_MANY_ANNEXES` o `ANNEXES_TOO_LARGE` y un mensaje claro, y no genera el documento. (El límite inicial de 10 era bajo: un perfil con muchos certificados lo superaba.)
- Nombre de descarga: `<slug>-CV-foto.pdf|docx` y `<slug>-CV-documentado.pdf|docx`.

### Frontend: generación

- Descarga con `fetch` + `Blob`, igual que SPEC 07 (`withCredentials`, control de 401).
- Durante la generación, el botón entra en estado de carga con animación (spinner o barra), se desactiva y muestra el texto "Generando…" / "Generating…". Al terminar, dispara la descarga.
- Si falla, mensaje inline. Sin persistencia del documento generado.

## Implementation plan

Cada paso deja el sistema compilable y funcionando.

1. **Base de datos.** Agregar los campos de `Profile`, `Education` y `Certification` en `schema.prisma`. Migración `profile_photo_and_documents` con `npm run prisma:migrate -w career-analyzer-backend -- --name profile_photo_and_documents`, y `npm run prisma:generate -w career-analyzer-backend`. La migración corre contra la base de desarrollo, nunca contra la de datos reales en e2e.
2. **Dependencias.** Instalar `pdf-lib`, `pdfjs-dist`, `@napi-rs/canvas` e `image-size` en la raíz del monorepo. Verificar `@napi-rs/canvas` en el contenedor Alpine (`docker compose exec backend node -e "require('@napi-rs/canvas')"`).
3. **Storage de archivos.** Crear `backend/src/profile/profile-files/`:
   - `file-signature.ts`: detección de JPG, PNG y PDF por magic bytes.
   - `profile-file-storage.service.ts`: `save(buffer, kind)` → `{ path, mimeType }`, `read(path)`, `remove(path)`, y resolución segura de rutas.
   - `profile-files.constants.ts`: límite de 10 MB.
4. **Flags y sincronización en `profile.service.ts`:**
   - `EducationDto` y `CertificationDto` reciben `showInCompactCv?` y `showInDocumentedCv?` (`@IsOptional @IsBoolean`). En la sincronización, si vienen `undefined`, se usa `true`.
   - `syncEducation` y `syncCertifications`: nunca escriben `documentPath`, `documentMimeType` ni `documentName`.
   - Antes del `deleteMany`, buscar las filas a borrar con `documentPath` y eliminar sus archivos del disco.
5. **Endpoints de archivos.** En `ProfileController` (o un controlador `ProfileFilesController` del mismo módulo):
   - Foto: `PUT`, `GET`, `DELETE /profile/photo`.
   - Documentos: `PUT`, `GET`, `DELETE` para `education/:id/document` y `certifications/:id/document`. Validar que el item pertenezca al perfil del usuario (404 si no).
   - `GET` sin archivo → 404.
6. **Carga de datos para generación.** En `cv-export.service.ts`:
   - `loadCvData` agrega a `education` y `certifications` los campos `id`, `showInCompactCv`, `showInDocumentedCv`, `documentPath`, `documentMimeType`, `documentName`.
   - `loadCvData` también incluye `photoPath` y `photoMimeType` en `CvData`.
   - Filtro de CV ATS por `showInCompactCv` en `education` y `certifications`. Antes de implementar, revisar con `grep` si `loadCvData` lo usan otros módulos (p. ej. `cv-adaptation`) y decidir si el filtro vive ahí o en el render del ATS.
7. **Módulo `cv-photo`:** `cv-photo.service.ts` con la plantilla PDF (`pdfmake`) y DOCX (`docx`), `cv-photo.controller.ts` con `GET /cv-photo`, y `cv-photo.module.ts`. Registrar en `app.module.ts`.
8. **Módulo `cv-documented`:** `cv-documented.service.ts`:
   - Reutiliza `CvPhotoService` para la primera parte (con variante `documented`).
   - Anexos PDF con `pdf-lib`. Anexos DOCX con `pdfjs-dist` y `@napi-rs/canvas`.
   - Límites de 30 anexos y 40 MB.
   - `cv-documented.controller.ts` con `GET /cv-documented` y `cv-documented.module.ts`. Registrar en `app.module.ts`.
9. **Frontend, perfil.** En `profile.component`:
   - Sección de foto (subir, reemplazar, borrar, preview con `<img src="/api/profile/photo">`).
   - En cada título y certificado: input de archivo, nombre del archivo adjunto con botones de ver y borrar, y los dos checks de visibilidad.
   - Modelos en `core/models/profile.ts` y servicio de perfil para subida multipart.
   - Claves de i18n en `es.ts` y `en.ts`.
10. **Frontend, generación.** Servicio `core/cv-export.service.ts` (ya existente de SPEC 07) con métodos para `cv-photo` y `cv-documented`. Botones con estado de carga animado en la página de perfil.
11. **Infraestructura.** Revisar `docker-compose.yml` (dev): si no monta un volumen para `uploads`, agregarlo, para que los archivos sobrevivan a reinicios. `docker-compose.prod.yml` ya lo monta.
12. **Verificación final.** `npm run build:all`, `npm run lint:all`, `npm run test -w career-analyzer-backend`, `npm run test -w career-analyzer-frontend`, y flujo manual (ver criterios).

## Acceptance criteria

- [x] `PUT /profile/photo` acepta JPG o PNG hasta 10 MB; rechaza otros tipos (400) y archivos mayores (413). El archivo se guarda con nombre aleatorio dentro de `uploads/profile/`.
- [x] `PUT /profile/photo` reemplazar elimina el archivo anterior del disco. `DELETE /profile/photo` elimina el archivo y limpia `photoPath`.
- [x] `GET /profile/photo` devuelve la imagen con el `Content-Type` correcto; sin foto → 404; de otro usuario → 404.
- [x] `PUT` de archivo de título o certificado acepta PDF, JPG y PNG hasta 10 MB; un PDF cifrado o corrupto → 400.
- [x] `PUT /profile` (sincronización) no borra ni altera los archivos adjuntos de items que siguen presentes; si quita un item, su archivo se elimina del disco.
- [x] `showInCompactCv` y `showInDocumentedCv` se persisten, tienen default `true`, y se reflejan en `GET /profile`.
- [x] `GET /cv-photo?format=pdf` y `format=docx` generan el documento con la foto (si existe), el diseño de referencia y los datos del perfil. El texto del PDF es seleccionable.
- [x] En `/cv-photo`, un certificado con `showInCompactCv = false` no aparece; en `/cv-export` (ATS) tampoco.
- [x] Barras de habilidades = `level/5`; barras de idiomas según la escala CEFR de 6 niveles; fechas en formato corto en `es` y `en`.
- [x] `GET /cv-documented?format=pdf` genera la primera parte del CV más un anexo por título o certificado con archivo y `showInDocumentedCv = true`, en orden de `sortOrder`, cada uno en su propia hoja con la cabecera de sección y sin páginas separadoras.
- [x] `GET /cv-documented?format=docx` genera lo mismo, con los PDF rasterizados como imágenes y las imágenes insertadas directamente.
- [x] Más de 30 anexos o más de 40 MB → 400 con mensaje claro; no se genera el documento.
- [x] Sin cookie → 401 en todos los endpoints nuevos. `format` inválido → 400. `lang` inválido → 400.
- [x] En el frontend, los botones de generación muestran la animación de carga mientras espera la respuesta y disparan la descarga al terminar.
- [x] Los archivos de documentos y foto sobreviven a un reinicio del backend (volumen en dev y prod).
- [x] Ningún documento generado se persiste, y no se usa `localStorage`.
- [x] `npm run build:all`, `npm run lint:all` y `npm run test -w career-analyzer-backend` pasan (unit + e2e), contra una base de prueba y no la de datos reales.
- [x] Verificación visual manual: el CV con foto se compara lado a lado con el Word de referencia y no tiene diferencias de estructura (franja, columnas, barras, orden de secciones).

## Decisions

- **Sí:** dos flags por item (`showInCompactCv`, `showInDocumentedCv`), default `true`, para que el CV ATS siga igual hasta que el usuario decida.
- **Sí:** el CV con foto usa `showInCompactCv` (es el documento compacto con diseño). El CV documentado usa `showInDocumentedCv` para la lista y los anexos.
- **Sí:** archivos en disco, no en la base de datos. Patrón consistente con los CV importados y los volúmenes de Docker ya existentes.
- **Sí:** validación de tipo por magic bytes y de tamaño (10 MB por archivo); PDF validado con `pdf-lib` al subir.
- **Sí:** anexos en PDF y DOCX con el mismo contenido. En DOCX los PDF se rasterizan; en PDF se copian sin pérdida.
- **Sí:** cabecera en la misma hoja del documento (no página separadora), con el documento escalado debajo para no superponer texto sobre el certificado. Orientación horizontal para documentos horizontales.
- **Sí:** límites de 30 anexos y 40 MB por generación, para evitar documentos inmanejables.
- **Sí:** `memoryStorage` en la subida, para validar antes de tocar el disco.
- **Sí:** barras de nivel solo en el CV con foto. El CV ATS mantiene la decisión de SPEC 09 (sin niveles).
- **No:** nacionalidad. Se quita del diseño y del modelo.
- **No:** LibreOffice ni otro conversor en el contenedor; se aceptan diferencias de render entre `pdfmake` y `docx`.
- **No:** recorte o edición de la foto.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| `@napi-rs/canvas` no tiene binario compatible con la imagen Alpine | Paso 2 lo verifica antes de implementar; si falla, se usa una imagen base Debian o un rasterizador alternativo, decidido con una nueva revisión de la spec. |
| Un PDF de certificado de muchas páginas genera muchas imágenes en el DOCX | Límite de 40 MB total y 30 anexos; las páginas se rasterizan a 150 DPI con JPEG 85. |
| Sincronización completa de `PUT /profile` borra archivos de items que el frontend recrea | Los archivos no viajan en el `PUT` y el `PUT` no escribe campos de archivo; el frontend conserva los `id` al editar. |
| Archivos huérfanos en disco tras borrar items | Eliminación explícita en `syncEducation`/`syncCertifications` y en el borrado de perfil; prueba de e2e que lo verifica. |
| Ruta de archivo manipulada | Rutas generadas por el servidor; la lectura valida que la ruta esté dentro de `uploads/profile/`. |
| Diferencias visuales entre `pdfmake` y `docx` | Aceptadas por decisión. La verificación manual compara con la referencia. |
| `loadCvData` usado por otros módulos (p. ej. CV adaptado) | Paso 6 revisa los consumidores antes de cambiar el filtro. |
| El icono ⚲ o ☎ no está en la fuente Roboto de pdfmake | Se verifica al implementar; si falta, se reemplaza por texto o por un icono en imagen. |
| Foto muy grande degrada la generación | Límite de 10 MB; si el rendimiento se resiente, una spec futura agrega redimensionado. |

## What is **not** in this spec

- Recorte o edición de la foto.
- Nacionalidad u otros datos personales nuevos.
- Compresión, conversión o validación de contenido de certificados.
- OCR o verificación de certificados.
- Traducción de nombres de certificados.
- Varias fotos por perfil.
- Enlaces públicos a documentos o CVs.
- Cambios en el CV ATS más allá del filtro `showInCompactCv`.

Cada uno, si llega, tendrá su propio spec.
