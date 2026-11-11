# SPEC 28 — Formulario modal y correcciones del perfil

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06, SPEC 17, SPEC 27
> **Date:** 2026-11-10
> **Objective:** Mejorar la edición del perfil: crear y editar cada ítem (experiencia, educación, certificaciones, proyectos, habilidades e idiomas) desde un modal, insertar los ítems nuevos arriba de la lista, habilitar el adjunto de archivos sin recargar la página y corregir la persistencia de los checkboxes de visibilidad de CV.

## Scope

**In:**

- Frontend `/profile`, secciones de experiencia, educación, certificaciones, proyectos, habilidades e idiomas:
  - La lista muestra cada ítem como tarjeta con su resumen (título, subtítulo y, si aplica, tags de duplicado o solapamiento), botones "Editar" y "Eliminar".
  - "+ Agregar" abre un modal con los campos del ítem. Al confirmar, el ítem nuevo se inserta arriba de la lista y la vista se posiciona en él.
  - "Editar" abre el mismo modal con una copia del ítem. Solo al confirmar se reemplaza el original; al cancelar, el ítem queda como estaba.
  - El modal se cierra con "Cancelar", con Escape o con clic en el fondo. "Aplicar" del modal valida el borrador y, si hay errores, los marca sin cerrar. Aplicar no guarda en el servidor: solo actualiza el formulario.
  - Los campos, validaciones y reglas (fechas, "trabajo actual", métricas, nivel) son los mismos que hoy.
  - Mientras haya cambios aplicados sin guardar, la barra fija inferior muestra "Cambios sin guardar" junto a "Guardar perfil".
  - El resultado de guardar (éxito o error) se muestra en un aviso fijo, siempre visible, no al inicio de la página.
  - Las validaciones del cliente se alinean con el backend: año 1900-2100, URL válida, campos obligatorios sin contar solo espacios, longitudes máximas y hasta 5 métricas por ítem. El modal nombra el campo inválido ("Certificación · Año: no puede ser menor que 1900").
  - Si el backend rechaza el guardado con un 400, el aviso indica sección, número de ítem y campo afectados.
- Adjuntos de título y certificado (SPEC 27): el componente de adjuntar vive en la tarjeta, no en el modal, y opera sobre el ítem real. Tras guardar el perfil, el adjunto queda habilitado sin recargar la página.
- Corrección: `showInCompactCv` y `showInDocumentedCv` de educación y certificaciones se incluyen en el payload de guardado (`buildBilingualPayload`), para que el valor elegido persista.
- Corrección de render: `loadProfileForm` (y `loadCvDraftForm`) reemplazan cada lista por una instancia nueva de `FormArray` con `setControl`, y el `@for` usa el grupo como `track`. Así el input de la sección cambia de referencia y la vista se vuelve a renderizar tras guardar (antes la lista se vaciaba y rellenaba in situ, la referencia no cambiaba y el adjunto seguía deshabilitado). Las suscripciones del componente de perfil pasan a `form.valueChanges` para sobrevivir al reemplazo de listas.
- Backend (`pdf-engine`): se registran políticas de acceso de pdfmake que deniegan URLs y archivos locales, eliminando los avisos de consola. Los PDFs no usan recursos externos.
- Backend (archivos del perfil): si el archivo de la foto o de un adjunto ya no existe en disco, la descarga no falla. La foto se omite, el anexo se omite con un aviso en el log, y los endpoints de archivo responden 404 en lugar de 500.
- Pruebas: unitarias de las secciones (crear arriba, cancelar sin cambios, editar una copia, eliminar, tags).

**Out of scope:**

- Cambios en el modelo de datos o en el backend de perfil (salvo la política de pdfmake).
- Reordenamiento manual de ítems (drag & drop).
- Edición en línea sin modal.
- Traducción o cambios de idioma de los campos.

## Implementation plan

1. `frontend/src/app/core/item-editor.ts`: `cloneGroup` (copia profunda de un FormGroup con validadores y estado disabled) y `ItemEditor` (borrador con `openNew`, `openEdit`, `confirm`, `dismiss`, `isNew`). Al confirmar un ítem nuevo, `insert(0, …)`; al confirmar una edición, `setControl(index, …)`.
2. `frontend/src/app/shared/profile-form/item-modal.component.ts`: modal con proyección de contenido, título, botones Cancelar/Aplicar y cierre con Escape.
3. Secciones (experiencia, educación, certificaciones, proyectos, habilidades, idiomas): lista de tarjetas, modal con los campos, sin `OnPush`. Certificaciones y educación mantienen el adjunto dentro de la tarjeta. El modal muestra el primer campo inválido con `app-form-error` (`core/profile-errors.ts`).
4. `frontend/src/app/core/bilingual-form.ts`: agregar `showInCompactCv` y `showInDocumentedCv` al mapeo de educación y certificaciones.
5. `frontend/src/styles/_components.scss`: estilos de `.item-card`.
6. Claves de i18n `common.apply`, `common.edit`, `profile.unsavedChanges`, `validation.*` en `es.ts` y `en.ts`.
7. `frontend/src/app/core/validators.ts`: `trimmedRequired`, `optionalUrl`, `optionalIntegerRange`, `commaSeparatedMaxLength`; se aplican en `profile-form.ts` junto con `MAX_METRICS = 5`. Las fechas parciales y los años no numéricos se normalizan al cargar para no bloquear el guardado.
8. `frontend/src/app/core/profile-errors.ts`: describe el primer error del formulario y traduce los mensajes de validación del backend (sección, ítem, campo).
9. `frontend/src/app/profile/profile.component.*`: señal `unsaved`, aviso fijo (`toast-stack`), descripción del error y desplazamiento al ítem o campo inválido.
10. `backend/src/cv-export/pdf-engine.ts`: `setUrlAccessPolicy(() => false)` y `setLocalAccessPolicy(() => false)` al inicializar las fuentes.
11. Pruebas: `profile-sections.spec.ts` actualizado para el flujo de modal, tope de métricas y botón "Aplicar"; `profile-form.spec.ts` para validadores; `profile-errors.spec.ts` para la descripción de errores.
12. Verificación: `npm run build:all`, `npm run lint:all`, `npm run test -w career-analyzer-frontend`, `npm run test -w career-analyzer-backend`, y revisión manual en `/profile`.

## Acceptance criteria

- [x] "+ Agregar" en cualquier sección abre el modal; el ítem nuevo aparece arriba de la lista al confirmar, sin bajar en la página.
- [x] "Editar" abre el modal con los datos actuales; cancelar no modifica el ítem.
- [x] "Eliminar" quita el ítem de la lista.
- [x] El botón del modal dice "Aplicar"; tras aplicarlo, la barra inferior indica "Cambios sin guardar" hasta pulsar "Guardar perfil".
- [x] El resultado de guardar se muestra en un aviso fijo visible desde cualquier posición de la página.
- [x] Las validaciones del cliente coinciden con el backend (año 1900-2100, URL, obligatorios sin espacios, longitudes, máximo 5 métricas) y el modal nombra el campo inválido.
- [x] Un 400 del backend se muestra con sección, número de ítem y campo.
- [x] Guardar el perfil persiste `showInCompactCv` y `showInDocumentedCv` de educación y certificaciones; el valor elegido se mantiene tras guardar.
- [x] Tras guardar el perfil, el adjunto de título y certificado queda habilitado sin recargar la página.
- [x] Tags de duplicado y de rango solapado se muestran en la tarjeta correspondiente.
- [x] La generación de PDF no imprime avisos de políticas de acceso de pdfmake.
- [x] `npm run build:all`, `npm run lint:all` y las pruebas unitarias de frontend y backend pasan.

## Decisions

- **Sí:** modal para crear y editar, en todas las secciones. Es la opción elegida por el usuario.
- **Sí:** copia del ítem para editar, para que cancelar no deje cambios a medio hacer.
- **Sí:** adjuntos dentro de la tarjeta, no en el modal, porque operan sobre el archivo en el servidor y no sobre el borrador.
- **Sí:** reemplazar las listas por instancias nuevas al cargar el perfil y quitar `OnPush` de las secciones. Mutar el `FormArray` en sitio no dispara el re-render, y el adjunto depende de leer el `id` del ítem en el render.
- **No:** reordenamiento manual de ítems; el orden sigue siendo el de la lista (nuevos arriba).
- **No:** guardado automático al aplicar el modal. Se mantiene "Guardar perfil" explícito y se agrega el indicador "Cambios sin guardar" para que la acción pendiente sea evidente.
- **Sí:** validar en el cliente lo mismo que el backend, para que el 400 sea la excepción y no el mecanismo normal de aviso.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Modal sin manejo de foco ni trampa de tabulación | Se cierra con Escape y clic en el fondo; se verifica manualmente con teclado. |
| Editar una copia puede perder cambios concurrentes en el original | El perfil se guarda completo; no hay edición concurrente en la misma sesión. |
| Quitar `OnPush` aumenta el número de chequeos de Angular | Las listas son pequeñas; el costo es despreciable. |
