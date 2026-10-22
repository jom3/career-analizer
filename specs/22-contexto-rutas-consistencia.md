# SPEC 22 — Contexto, rutas y consistencia

> **Status:** Approved
> **Depends on:** SPEC 11 (match), SPEC 12 (adaptación de CV), SPEC 13 (carta), SPEC 18 (idioma de interfaz, parcialmente reemplazada en lo que respecta al idioma de generación), SPEC 19 (recuperación de contraseña)
> **Date:** 2026-10-22
> **Objective:** Que cada resultado generado indique a qué oferta pertenece, que el usuario elija el idioma del documento de forma independiente a la interfaz, que las rutas no terminen en callejones sin salida, que la sesión expirada se maneje bien, y que los textos sean consistentes.
> **Orden de implementación:** 1.º (primero, por bajo riesgo y valor inmediato).

## Scope

**In:**

- **Contexto de oferta** en listas y detalles de match, carta y CV adaptado: título, empresa, enlace a la oferta.
- **Matches sin guardar** identificados como tales, con acción para guardar la oferta.
- **Idioma del documento** elegible por el usuario, con la interfaz como valor por defecto.
- **Carta editable después de guardar**, con el tag de origen corregido.
- **Selector de oferta** en `/cover-letter/new` cuando no llega `jobOfferId`.
- **Sesión expirada:** interceptor 401 que limpia la sesión y redirige a login con retorno.
- **Dashboard:** completitud del perfil con todas las secciones, errores visibles, documentos separados por tipo, ofertas pendientes.
- **Formulario de perfil compartido** entre `/profile` y `/cv-import`.
- **Textos consistentes:** voseo rioplatense en toda la interfaz; errores del backend como códigos traducidos en el frontend.

**Out:**

- Cambios en el score, la cobertura o los prompts (SPEC 20 y 21).
- Nuevos idiomas más allá de es/en.
- Cambios en login, registro o recuperación de contraseña (SPEC 19), salvo el manejo de 401.

## Decisions

- **Sí:** **idioma del documento independiente de la interfaz**, con default igual al idioma de interfaz. Se elige en la acción de generar (adaptar CV, redactar carta), no en un ajuste global.
- **Sí:** **el idioma de interfaz sigue viajando por `Accept-Language`** para mensajes y dashboards. Para generación, el backend usa el parámetro `lang` explícito y solo cae al header si falta.
- **Sí:** **voseo rioplatense** (`Pegá`, `Subí`, `Intentá`, `Revisá`) en toda la interfaz, ya que es la forma que ya usa la mayoría de la app.
- **Sí:** **errores del backend como códigos** (`JOB_OFFER_EMPTY`, `AI_UNAVAILABLE`, etc.). El frontend los traduce con i18n. Los mensajes en español del backend quedan solo en logs.
- **Sí:** **carta editable** después de guardar: `PATCH /cover-letter/:id` actualiza `content` y marca `editedByUser`. El tag pasa de "Editado por ti" a "Generada con IA" o "Editada por ti" según corresponda.
- **Sí:** **contexto de oferta en las listas** con snapshot como respaldo si la oferta fue eliminada (`onDelete: SetNull` en el schema).
- **No:** cambiar el valor por defecto del idioma de interfaz (sigue en `es`).

## Data model and API

Sin cambios de schema, salvo `CoverLetter.editedByUser Boolean @default(false)` (migración `cover_letter_edited_by_user`).

Respuestas de listas y detalles (aditivas):

```ts
interface OfferContext {
  id: string | null;      // null si la oferta fue eliminada o nunca se guardó
  title: string;          // de la oferta o del snapshot
  company: string | null;
  url: string | null;
  saved: boolean;         // false para matches calculados sin guardar
}
```

Campo `offer: OfferContext` en `JobMatchDto`, `AdaptedCvDto` y `CoverLetterDto`.

Nuevos endpoints:

- `POST /job-match/:id/save-offer`: crea un `JobOffer` a partir de `offerSnapshot` y lo vincula al match.
- `PATCH /cover-letter/:id`: body `{ content: string }`, marca `editedByUser: true`.

Parámetro `lang?: 'es' | 'en'` (idioma del documento) en:

- `POST /cv-adaptation` y `POST /cv-adaptation/:id/regenerate`.
- `POST /cover-letter/draft` y `POST /cover-letter`.

Si falta, se usa `req.uiLang` (SPEC 18), y luego `es`.

## Implementation plan

1. **Backend — `OfferContext`:** helper `toOfferContext(record)` que usa la oferta relacionada o el snapshot. Aplicar en `JobMatchService`, `CvAdaptationService` y `CoverLetterService` (`toDto`).
2. **Backend — `save-offer`:** reutilizar `JobAnalysisService.create` con el snapshot. Actualizar `jobOfferId` del match. Error si ya tiene oferta.
3. **Backend — idioma del documento:** DTOs con `lang` opcional; servicios usan `lang ?? uiLang ?? 'es'`. Test: `lang` explícito gana sobre `Accept-Language`.
4. **Backend — `PATCH /cover-letter/:id`:** valida ownership, longitud máxima 20 000 caracteres, marca `editedByUser`.
5. **Backend — códigos de error:** enum `ApiErrorCode` en `backend/src/common/api-error-codes.ts`. Los servicios lanzan `BadGatewayException({ code: 'AI_UNAVAILABLE' })` y similares. Mantener el mensaje en español solo en logs.
6. **Frontend — componente `OfferContextCard`:** título, empresa, enlace (`target="_blank" rel="noopener noreferrer"`) y "Ver en ofertas" (`/job-analysis?offer=<id>`). Usado en match, CV adaptado y carta, listas y detalles.
7. **Frontend — `job-analysis` acepta `?offer=<id>`:** resalta y desplaza a la oferta.
8. **Frontend — selector de idioma del documento** (`DocumentLangSelect`): usado en "Adaptar CV" (ofertas y match) y en la carta nueva. Default = `i18n.lang()`.
9. **Frontend — carta editable:** en el detalle, textarea + "Guardar cambios" (`PATCH`). Tag según `editedByUser`.
10. **Frontend — `/cover-letter/new` sin oferta:** lista de ofertas guardadas con botón "Redactar carta" por oferta; si no hay ofertas, enlace a `/job-analysis`.
11. **Frontend — interceptor 401:** `auth.interceptor.ts` detecta 401 (excepto `/auth/me` durante el guard), limpia `AuthService.user`, navega a `/auth/login?returnUrl=<ruta>`. El login respeta `returnUrl`.
12. **Frontend — dashboard:**
    - Completitud: 6 checks iguales (titular o resumen, experiencia, educación, skills, proyectos o certificaciones, idiomas). Mostrar cuáles faltan.
    - Errores de carga visibles con botón de reintentar (hoy se tragan en `loadProfile`).
    - Documentos separados: "CVs adaptados" y "Cartas" con su propio enlace.
    - Contador de ofertas con estado PENDING.
13. **Frontend — formulario de perfil compartido:** extraer `ProfileFormComponent` (secciones de experiencia, skills, educación, certificaciones, proyectos, idiomas) usado por `/profile` y `/cv-import`.
14. **Textos:**
    - Reemplazar `Intenta`, `Intentalo`, `Revisa`, `Ingresá` por la forma de voseo.
    - Agregar un test en `i18n.templates.spec.ts` que falle si aparecen formas de tuteo en las claves de `es.ts`.
15. **Errores del backend:** el frontend mapea `code` a `i18n` (`errors.AI_UNAVAILABLE`, etc.). Paridad es/en verificada por `i18n.dictionaries.spec.ts`.

## Tests

**Backend:**

- `toOfferContext`: oferta existente, oferta eliminada (usa snapshot), match sin guardar (`saved: false`).
- `save-offer`: crea la oferta, vincula el match, rechaza si ya tiene oferta, rechaza si no es del usuario.
- Idioma: `lang` explícito gana sobre `Accept-Language`; sin ninguno, `es`.
- `PATCH /cover-letter/:id`: ownership, longitud, marca `editedByUser`.
- Códigos de error: el body de los errores de IA trae `code`, no texto en español como único mensaje.

**Frontend:**

- `auth.interceptor`: 401 limpia sesión y redirige con `returnUrl`; login vuelve a `returnUrl`.
- Dashboard: perfil con solo skills no marca 100%; error de carga muestra mensaje y reintento.
- i18n: paridad de claves (existente) y no aparecen formas de tuteo.

**E2E (`backend/test`):** flujo "analizar oferta → guardar → calcular match → ver contexto de oferta en el match" con idioma de documento distinto a la interfaz.

## Acceptance criteria

- [ ] Match, carta y CV adaptado muestran título, empresa y enlace de la oferta en lista y detalle.
- [ ] Un match sin guardar se identifica como tal y permite guardar la oferta.
- [ ] El usuario elige el idioma del documento al adaptar CV o redactar carta; el default es el idioma de interfaz.
- [ ] `lang` explícito tiene prioridad sobre `Accept-Language` en generación.
- [ ] La carta se puede editar y guardar después de creada; el tag refleja el origen real.
- [ ] `/cover-letter/new` sin `jobOfferId` permite elegir una oferta guardada.
- [ ] Una sesión expirada lleva a login y vuelve a la ruta original tras autenticarse.
- [ ] El dashboard marca 100% solo con todas las secciones completas y muestra errores de carga con reintento.
- [ ] El formulario de perfil existe en un único componente usado en ambas pantallas.
- [ ] Los textos de la interfaz usan voseo consistente; el test de tuteo pasa.
- [ ] Los errores del backend incluyen `code`; el frontend los traduce.
- [ ] `npm run build:all`, `npm run lint:all` y `npm run test:all` pasan.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Migrar errores a códigos rompe clientes existentes | Frontend es el único cliente; el campo `message` se mantiene como respaldo durante esta spec. |
| El selector de idioma confunde al usuario | Default visible y etiquetado; el resultado muestra el idioma del documento (ya existe). |
| Extraer el formulario de perfil rompe `/cv-import` | Tests de ambas pantallas antes de eliminar el código duplicado. |
| Redirección 401 en bucle al cargar `/auth/me` | El interceptor ignora `/auth/me` y el guard ya maneja ese caso. |
| Voseo en claves existentes rompe paridad | Cambio en ambos diccionarios en el mismo commit, con el test de paridad. |

## Notas de supersedencia

- **SPEC 18:** el idioma de **generación** (CV adaptado, carta, match) pasa a ser el idioma del documento elegido, con default en la interfaz. El idioma de **interfaz** y el header `Accept-Language` siguen igual.

## What is **not** in this spec

- Nuevos idiomas.
- Cambios de score o prompts (SPEC 20 y 21).
- Cambios en autenticación más allá del manejo de 401.
